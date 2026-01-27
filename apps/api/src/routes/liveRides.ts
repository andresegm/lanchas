import type { FastifyPluginAsync } from "fastify";
import { LiveRideOfferStatus, LiveRideStatus, NotificationType, Rumbo, TripStatus, prisma } from "@lanchas/prisma";
import { requireAuthed, requireCaptain } from "../auth/guards.js";

type CreateLiveRideBody = {
    pickupPoint?: string;
    rumbo?: string;
    passengerCount?: number;
    hours?: number;
};

function fixedRateCents(rumbo: Rumbo): number {
    if (rumbo === Rumbo.RUMBO_1) return 60_00;
    if (rumbo === Rumbo.RUMBO_2) return 80_00;
    return 100_00;
}

function durationHoursCeil(startAt: Date, endAt: Date): number {
    const ms = endAt.getTime() - startAt.getTime();
    return Math.ceil(ms / (1000 * 60 * 60));
}

const LIVE_RIDE_OFFER_TIMEOUT_MS = 60 * 1000; // 60 seconds

export async function checkAndExpireOffers() {
    const expiredCutoff = new Date(Date.now() - LIVE_RIDE_OFFER_TIMEOUT_MS);
    const expiredOffers = await prisma.liveRideOffer.findMany({
        where: {
            status: LiveRideOfferStatus.OFFERED,
            createdAt: { lt: expiredCutoff }
        },
        include: {
            request: {
                include: {
                    offers: { select: { captainId: true } }
                }
            }
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

        const next = await pickNextCaptainOffer({
            rumbo: ride.rumbo,
            passengerCount: ride.passengerCount,
            startAt,
            endAt,
            excludeCaptainIds: already
        });

        await prisma.$transaction(async (tx) => {
            await tx.liveRideOffer.update({
                where: { id: offer.id },
                data: { status: LiveRideOfferStatus.REJECTED }
            });

            if (!next) {
                await tx.liveRideRequest.update({
                    where: { id: ride.id },
                    data: { status: LiveRideStatus.REQUESTED, offeredToCaptainId: null }
                });
                return;
            }

            await tx.liveRideOffer.create({
                data: {
                    requestId: ride.id,
                    captainId: next.captainId,
                    boatId: next.boatId,
                    status: LiveRideOfferStatus.OFFERED
                }
            });

            await tx.liveRideRequest.update({
                where: { id: ride.id },
                data: { status: LiveRideStatus.OFFERED, offeredToCaptainId: next.captainId }
            });

            await tx.notification.create({
                data: {
                    userId: next.captainUserId,
                    type: NotificationType.LIVE_RIDE_OFFER,
                    liveRideRequestId: ride.id
                }
            });
        });
    }
}

async function pickNextCaptainOffer(args: {
    rumbo: Rumbo;
    passengerCount: number;
    startAt: Date;
    endAt: Date;
    excludeCaptainIds: string[];
}) {
    // Dev: Prioritize specific captain email if they have live rides enabled
    const DEV_PRIORITY_EMAIL = "andresegm@gmail.com";

    // First, try to find the dev priority captain if not excluded
    if (!args.excludeCaptainIds.some((id) => {
        // We'll check by email, so we need to find the captain first
        return false; // Will check below
    })) {
        const priorityCaptain = await prisma.captain.findFirst({
            where: {
                user: { email: DEV_PRIORITY_EMAIL },
                boats: {
                    some: {
                        liveRidesOn: true,
                        maxPassengers: { gte: args.passengerCount },
                        rumboPricings: { some: { rumbo: args.rumbo } },
                        trips: {
                            none: {
                                status: { in: [TripStatus.ACCEPTED, TripStatus.ACTIVE] },
                                startAt: { lt: args.endAt },
                                endAt: { gt: args.startAt }
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
                        maxPassengers: { gte: args.passengerCount },
                        rumboPricings: { some: { rumbo: args.rumbo } },
                        trips: {
                            none: {
                                status: { in: [TripStatus.ACCEPTED, TripStatus.ACTIVE] },
                                startAt: { lt: args.endAt },
                                endAt: { gt: args.startAt }
                            }
                        }
                    },
                    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                    select: { id: true },
                    take: 1
                }
            }
        });

        if (priorityCaptain && !args.excludeCaptainIds.includes(priorityCaptain.id) && priorityCaptain.boats[0]) {
            return { captainId: priorityCaptain.id, captainUserId: priorityCaptain.userId, boatId: priorityCaptain.boats[0].id };
        }
    }

    // Otherwise, use normal selection logic
    const captains = await prisma.captain.findMany({
        where: {
            id: { notIn: args.excludeCaptainIds.length ? args.excludeCaptainIds : undefined },
            boats: {
                some: {
                    liveRidesOn: true,
                    maxPassengers: { gte: args.passengerCount },
                    rumboPricings: { some: { rumbo: args.rumbo } },
                    trips: {
                        none: {
                            status: { in: [TripStatus.ACCEPTED, TripStatus.ACTIVE] },
                            startAt: { lt: args.endAt },
                            endAt: { gt: args.startAt }
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
                    maxPassengers: { gte: args.passengerCount },
                    rumboPricings: { some: { rumbo: args.rumbo } },
                    trips: {
                        none: {
                            status: { in: [TripStatus.ACCEPTED, TripStatus.ACTIVE] },
                            startAt: { lt: args.endAt },
                            endAt: { gt: args.startAt }
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

    const c = captains[0];
    if (!c || !c.boats[0]) return null;
    return { captainId: c.id, captainUserId: c.userId, boatId: c.boats[0].id };
}

export const liveRidesRoutes: FastifyPluginAsync = async (app) => {
    // User creates a live ride request (one-at-a-time offer to captains with live rides enabled)
    app.post<{ Body: CreateLiveRideBody }>("/live-rides", async (req) => {
        const payload = await requireAuthed(app, req);

        const pickupPoint = "Plaza Mayor"; // fixed for MVP

        const rumboKey = req.body.rumbo;
        if (!rumboKey || !(rumboKey in Rumbo)) throw app.httpErrors.badRequest("rumbo is required");
        const rumbo = Rumbo[rumboKey as keyof typeof Rumbo];

        const passengerCount = Number(req.body.passengerCount);
        if (!Number.isFinite(passengerCount) || passengerCount < 1) throw app.httpErrors.badRequest("passengerCount must be >= 1");

        const hours = Number(req.body.hours);
        if (!Number.isFinite(hours) || hours < 4) throw app.httpErrors.badRequest("hours must be >= 4");

        const startAt = new Date();
        const endAt = new Date(startAt.getTime() + hours * 60 * 60 * 1000);

        const hourlyRateCents = fixedRateCents(rumbo);
        const subtotalCents = hourlyRateCents * hours;
        const commissionRate = 0.18;
        const commissionCents = Math.round(subtotalCents * commissionRate);
        const totalCents = subtotalCents + commissionCents;

        // Check for expired offers before creating new request
        await checkAndExpireOffers();

        const offer = await pickNextCaptainOffer({
            rumbo,
            passengerCount,
            startAt,
            endAt,
            excludeCaptainIds: []
        });
        if (!offer) throw app.httpErrors.conflict("No captains available for live rides right now");

        const created = await prisma.$transaction(async (tx) => {
            const ride = await tx.liveRideRequest.create({
                data: {
                    createdById: payload.sub,
                    pickupPoint,
                    rumbo,
                    passengerCount,
                    hours,
                    hourlyRateCents,
                    subtotalCents,
                    commissionRate,
                    commissionCents,
                    totalCents,
                    currency: "USD",
                    status: LiveRideStatus.OFFERED,
                    offeredToCaptainId: offer.captainId
                }
            });

            await tx.liveRideOffer.create({
                data: {
                    requestId: ride.id,
                    captainId: offer.captainId,
                    boatId: offer.boatId,
                    status: LiveRideOfferStatus.OFFERED
                }
            });

            await tx.notification.create({
                data: {
                    userId: offer.captainUserId,
                    type: NotificationType.LIVE_RIDE_OFFER,
                    liveRideRequestId: ride.id
                }
            });

            return ride;
        });

        return { liveRide: created };
    });

    // Captain accepts a live ride offer -> creates an ACTIVE Trip immediately (on-the-spot)
    app.post<{ Params: { id: string } }>("/live-rides/:id/accept", async (req) => {
        // Check for expired offers before processing
        await checkAndExpireOffers();

        const { captain } = await requireCaptain(app, req);
        const now = new Date();

        const ride = await prisma.liveRideRequest.findUnique({
            where: { id: req.params.id },
            include: {
                createdBy: { select: { id: true } },
                offers: { where: { captainId: captain.id }, orderBy: { createdAt: "desc" }, take: 1 }
            }
        });
        if (!ride) throw app.httpErrors.notFound("Live ride not found");
        if (ride.status !== LiveRideStatus.OFFERED) throw app.httpErrors.badRequest("Live ride is not currently offered");
        if (ride.offeredToCaptainId !== captain.id) throw app.httpErrors.forbidden("Not offered to you");

        const offer = ride.offers[0];
        if (!offer || offer.status !== LiveRideOfferStatus.OFFERED) throw app.httpErrors.forbidden("No active offer");

        const startAt = now;
        const endAt = new Date(startAt.getTime() + ride.hours * 60 * 60 * 1000);
        const hours = durationHoursCeil(startAt, endAt);

        const snapshot = {
            type: "LIVE_RIDE_FIXED",
            pickupPoint: ride.pickupPoint,
            rumbo: ride.rumbo,
            currency: ride.currency,
            hourlyRateCents: ride.hourlyRateCents
        };

        const trip = await prisma.$transaction(async (tx) => {
            const createdTrip = await tx.trip.create({
                data: {
                    boatId: offer.boatId,
                    createdById: ride.createdById,
                    status: TripStatus.ACTIVE,
                    startAt,
                    endAt,
                    passengerCount: ride.passengerCount,
                    notes: `Pickup: ${ride.pickupPoint}`,
                    pricingSnapshot: snapshot as any,
                    subtotalCents: ride.hourlyRateCents * hours,
                    commissionRate: ride.commissionRate,
                    commissionCents: Math.round(ride.hourlyRateCents * hours * ride.commissionRate),
                    totalCents: ride.totalCents,
                    currency: ride.currency,
                    participants: { create: { userId: ride.createdById } }
                }
            });

            await tx.liveRideOffer.update({
                where: { id: offer.id },
                data: { status: LiveRideOfferStatus.ACCEPTED }
            });

            await tx.liveRideRequest.update({
                where: { id: ride.id },
                data: { status: LiveRideStatus.ACCEPTED, tripId: createdTrip.id }
            });

            return createdTrip;
        });

        return { trip };
    });

    // Captain rejects -> offer next eligible captain (one at a time)
    app.post<{ Params: { id: string } }>("/live-rides/:id/reject", async (req) => {
        // Check for expired offers before processing
        await checkAndExpireOffers();

        const { captain } = await requireCaptain(app, req);
        const ride = await prisma.liveRideRequest.findUnique({
            where: { id: req.params.id },
            include: { offers: { select: { captainId: true } } }
        });
        if (!ride) throw app.httpErrors.notFound("Live ride not found");
        if (ride.status !== LiveRideStatus.OFFERED) throw app.httpErrors.badRequest("Live ride is not currently offered");
        if (ride.offeredToCaptainId !== captain.id) throw app.httpErrors.forbidden("Not offered to you");

        const now = new Date();
        const startAt = now;
        const endAt = new Date(startAt.getTime() + ride.hours * 60 * 60 * 1000);

        const already = Array.from(new Set([...(ride.offers?.map((o) => o.captainId) ?? []), captain.id]));

        const next = await pickNextCaptainOffer({
            rumbo: ride.rumbo,
            passengerCount: ride.passengerCount,
            startAt,
            endAt,
            excludeCaptainIds: already
        });

        await prisma.$transaction(async (tx) => {
            await tx.liveRideOffer.updateMany({
                where: { requestId: ride.id, captainId: captain.id, status: LiveRideOfferStatus.OFFERED },
                data: { status: LiveRideOfferStatus.REJECTED }
            });

            if (!next) {
                await tx.liveRideRequest.update({
                    where: { id: ride.id },
                    data: { status: LiveRideStatus.REQUESTED, offeredToCaptainId: null }
                });
                return;
            }

            await tx.liveRideOffer.create({
                data: {
                    requestId: ride.id,
                    captainId: next.captainId,
                    boatId: next.boatId,
                    status: LiveRideOfferStatus.OFFERED
                }
            });

            await tx.liveRideRequest.update({
                where: { id: ride.id },
                data: { status: LiveRideStatus.OFFERED, offeredToCaptainId: next.captainId }
            });

            await tx.notification.create({
                data: {
                    userId: next.captainUserId,
                    type: NotificationType.LIVE_RIDE_OFFER,
                    liveRideRequestId: ride.id
                }
            });
        });

        return { ok: true };
    });
};

