import type { FastifyPluginAsync } from "fastify";
import { LiveRideOfferStatus, LiveRideStatus, NotificationType, TripStatus, prisma } from "@lanchas/prisma";
import { requireAuthed } from "../auth/guards.js";

function truthy(v: unknown): boolean {
    if (v === true) return true;
    if (v === 1) return true;
    const s = String(v ?? "").toLowerCase();
    return s === "1" || s === "true" || s === "yes";
}

// Helper to check and expire old live ride offers (60 second timeout)
async function checkAndExpireLiveRideOffers() {
    const TIMEOUT_MS = 60 * 1000; // 60 seconds
    const expiredCutoff = new Date(Date.now() - TIMEOUT_MS);

    const expiredOffers = await prisma.liveRideOffer.findMany({
        where: {
            status: LiveRideOfferStatus.OFFERED,
            createdAt: { lt: expiredCutoff }
        },
        include: {
            request: {
                include: {
                    offers: { select: { captainId: true } },
                    createdBy: { select: { id: true } }
                }
            },
            captain: { select: { userId: true } }
        }
    });

    for (const offer of expiredOffers) {
        const ride = offer.request;
        if (ride.status !== LiveRideStatus.OFFERED) continue;
        if (ride.offeredToCaptainId !== offer.captainId) continue;

        const now = new Date();
        const startAt = now;
        const endAt = new Date(startAt.getTime() + ride.hours * 60 * 60 * 1000);
        const already = Array.from(new Set([...(ride.offers?.map((o) => o.captainId) ?? []), offer.captainId]));

        // Find next eligible captain (dev: prioritize andresegm@gmail.com)
        const DEV_PRIORITY_EMAIL = "andresegm@gmail.com";

        // First try dev priority captain if not excluded
        let nextCaptains: Array<{ id: string; userId: string; boats: Array<{ id: string }> }> = [];
        if (!already.some((id) => {
            // Check if dev captain is excluded by trying to find them first
            return false; // Will check below
        })) {
            const priorityCaptain = await prisma.captain.findFirst({
                where: {
                    user: { email: DEV_PRIORITY_EMAIL },
                    id: { notIn: already.length ? already : undefined },
                    boats: {
                        some: {
                            liveRidesOn: true,
                            maxPassengers: { gte: ride.passengerCount },
                            rumboPricings: { some: { rumbo: ride.rumbo } },
                            trips: {
                                none: {
                                    status: { in: [TripStatus.ACCEPTED, TripStatus.ACTIVE] },
                                    startAt: { lt: endAt },
                                    endAt: { gt: startAt }
                                }
                            }
                        }
                    }
                },
                select: {
                    id: true,
                    userId: true,
                    boats: {
                        where: {
                            liveRidesOn: true,
                            maxPassengers: { gte: ride.passengerCount },
                            rumboPricings: { some: { rumbo: ride.rumbo } },
                            trips: {
                                none: {
                                    status: { in: [TripStatus.ACCEPTED, TripStatus.ACTIVE] },
                                    startAt: { lt: endAt },
                                    endAt: { gt: startAt }
                                }
                            }
                        },
                        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                        select: { id: true },
                        take: 1
                    }
                }
            });

            if (priorityCaptain && priorityCaptain.boats[0]) {
                nextCaptains = [priorityCaptain];
            }
        }

        // If no priority captain found, use normal selection
        if (nextCaptains.length === 0) {
            nextCaptains = await prisma.captain.findMany({
                where: {
                    id: { notIn: already.length ? already : undefined },
                    boats: {
                        some: {
                            liveRidesOn: true,
                            maxPassengers: { gte: ride.passengerCount },
                            rumboPricings: { some: { rumbo: ride.rumbo } },
                            trips: {
                                none: {
                                    status: { in: [TripStatus.ACCEPTED, TripStatus.ACTIVE] },
                                    startAt: { lt: endAt },
                                    endAt: { gt: startAt }
                                }
                            }
                        }
                    }
                },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: {
                    id: true,
                    userId: true,
                    boats: {
                        where: {
                            liveRidesOn: true,
                            maxPassengers: { gte: ride.passengerCount },
                            rumboPricings: { some: { rumbo: ride.rumbo } },
                            trips: {
                                none: {
                                    status: { in: [TripStatus.ACCEPTED, TripStatus.ACTIVE] },
                                    startAt: { lt: endAt },
                                    endAt: { gt: startAt }
                                }
                            }
                        },
                        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                        select: { id: true },
                        take: 1
                    }
                },
                take: 1
            });
        }

        const next = nextCaptains[0];
        const nextBoat = next?.boats[0];

        await prisma.$transaction(async (tx) => {
            await tx.liveRideOffer.update({
                where: { id: offer.id },
                data: { status: LiveRideOfferStatus.REJECTED }
            });

            if (!next || !nextBoat) {
                await tx.liveRideRequest.update({
                    where: { id: ride.id },
                    data: { status: LiveRideStatus.REQUESTED, offeredToCaptainId: null }
                });
                return;
            }

            await tx.liveRideOffer.create({
                data: {
                    requestId: ride.id,
                    captainId: next.id,
                    boatId: nextBoat.id,
                    status: LiveRideOfferStatus.OFFERED
                }
            });

            await tx.liveRideRequest.update({
                where: { id: ride.id },
                data: { status: LiveRideStatus.OFFERED, offeredToCaptainId: next.id }
            });

            await tx.notification.create({
                data: {
                    userId: next.userId,
                    type: NotificationType.LIVE_RIDE_OFFER,
                    liveRideRequestId: ride.id
                }
            });
        });
    }
}

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
    app.get("/notifications/me", async (req) => {
        // Check for expired live ride offers when fetching notifications
        // This ensures expired offers are cleaned up during the polling cycle (every 5 seconds)
        await checkAndExpireLiveRideOffers();

        const payload = await requireAuthed(app, req);
        const q = (req.query ?? {}) as Record<string, unknown>;
        const unreadOnly = truthy(q.unreadOnly);
        const limit = Math.max(1, Math.min(50, Number(q.limit ?? 20) || 20));

        const [unreadCount, notifications] = await Promise.all([
            prisma.notification.count({ where: { userId: payload.sub, readAt: null } }),
            prisma.notification.findMany({
                where: { userId: payload.sub, ...(unreadOnly ? { readAt: null } : {}) },
                orderBy: { createdAt: "desc" },
                take: limit,
                include: {
                    trip: {
                        select: {
                            id: true,
                            startAt: true,
                            endAt: true,
                            passengerCount: true,
                            pricingSnapshot: true,
                            boat: { select: { id: true, name: true } },
                            createdBy: { select: { id: true, email: true } }
                        }
                    },
                    liveRideRequest: {
                        select: {
                            id: true,
                            pickupPoint: true,
                            rumbo: true,
                            passengerCount: true,
                            hours: true,
                            totalCents: true,
                            currency: true,
                            createdAt: true,
                            createdBy: { select: { id: true, email: true } }
                        }
                    }
                }
            })
        ]);

        return {
            unreadCount,
            notifications: notifications.map((n) => ({
                id: n.id,
                type: n.type,
                createdAt: n.createdAt,
                readAt: n.readAt,
                trip: n.trip
                    ? {
                        id: n.trip.id,
                        startAt: n.trip.startAt,
                        endAt: n.trip.endAt,
                        passengerCount: n.trip.passengerCount,
                        rumbo: (n.trip.pricingSnapshot as any)?.rumbo ?? null,
                        boat: n.trip.boat,
                        createdBy: n.trip.createdBy
                    }
                    : null
                ,
                liveRide: n.liveRideRequest
                    ? {
                        id: n.liveRideRequest.id,
                        pickupPoint: n.liveRideRequest.pickupPoint,
                        rumbo: n.liveRideRequest.rumbo,
                        passengerCount: n.liveRideRequest.passengerCount,
                        hours: n.liveRideRequest.hours,
                        currency: n.liveRideRequest.currency,
                        totalCents: n.liveRideRequest.totalCents,
                        createdBy: n.liveRideRequest.createdBy
                    }
                    : null
            }))
        };
    });

    app.post<{ Params: { id: string } }>("/notifications/:id/read", async (req) => {
        const payload = await requireAuthed(app, req);

        const n = await prisma.notification.findUnique({
            where: { id: req.params.id },
            select: { id: true, userId: true, readAt: true }
        });
        if (!n) throw app.httpErrors.notFound("Notification not found");
        if (n.userId !== payload.sub) throw app.httpErrors.forbidden("Not yours");

        if (!n.readAt) {
            await prisma.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
        }

        return { ok: true };
    });

    // convenience: mark all as read
    app.post("/notifications/read-all", async (req) => {
        const payload = await requireAuthed(app, req);
        await prisma.notification.updateMany({
            where: { userId: payload.sub, readAt: null },
            data: { readAt: new Date() }
        });
        return { ok: true };
    });
};

