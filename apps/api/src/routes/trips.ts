import type { FastifyPluginAsync } from "fastify";
import { IncidentType, NotificationType, PaymentStatus, ReviewTargetType, Rumbo, TripStatus, prisma } from "@lanchas/prisma";
import { requireAuthed, requireCaptain } from "../auth/guards.js";

type CreateTripBody = {
    boatId?: string;
    pricingType?: "PRIVATE_HOURLY";
    rumbo?: string;
    passengerCount?: number;
    startAt?: string;
    endAt?: string;
    notes?: string;
};

function parseDateIso(input: string | undefined): Date | null {
    if (!input) return null;
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

function durationHoursCeil(startAt: Date, endAt: Date): number {
    const ms = endAt.getTime() - startAt.getTime();
    return Math.ceil(ms / (1000 * 60 * 60));
}

export const tripsRoutes: FastifyPluginAsync = async (app) => {
    app.get<{ Params: { id: string } }>("/trips/:id", async (req) => {
        const payload = await requireAuthed(app, req);
        const trip = await prisma.trip.findUnique({
            where: { id: req.params.id },
            include: {
                boat: { include: { captain: { select: { id: true, userId: true, displayName: true } } } },
                participants: { include: { user: { select: { id: true, email: true } } } },
                payment: true,
                incidents: { orderBy: { createdAt: "desc" } },
                reviews: { orderBy: { createdAt: "desc" } }
            }
        });
        if (!trip) throw app.httpErrors.notFound("Trip not found");

        const isParticipant = trip.participants.some((p) => p.userId === payload.sub);
        // Trip detail page is guest-facing; captains should not access it.
        if (!isParticipant) throw app.httpErrors.forbidden("Guests only");

        return { trip };
    });

    // Captain-safe trip detail (no incidents/reviews; includes guest contact + pax)
    app.get<{ Params: { id: string } }>("/trips/:id/captain", async (req) => {
        const { captain } = await requireCaptain(app, req);
        const trip = await prisma.trip.findUnique({
            where: { id: req.params.id },
            include: {
                boat: { select: { id: true, name: true, captainId: true } },
                createdBy: { select: { id: true, email: true } },
                payment: true
            }
        });
        if (!trip) throw app.httpErrors.notFound("Trip not found");
        if (trip.boat.captainId !== captain.id) throw app.httpErrors.forbidden("Not your trip");

        return {
            trip: {
                id: trip.id,
                status: trip.status,
                startAt: trip.startAt,
                endAt: trip.endAt,
                rumbo: (trip.pricingSnapshot as any)?.rumbo ?? null,
                passengerCount: trip.passengerCount,
                notes: trip.notes,
                currency: trip.currency,
                totalCents: trip.totalCents,
                boat: { id: trip.boat.id, name: trip.boat.name },
                createdBy: trip.createdBy,
                payment: trip.payment
            }
        };
    });

    // User creates a trip request (private or per-person)
    app.post<{ Body: CreateTripBody }>("/trips", async (req) => {
        const payload = await requireAuthed(app, req);

        const boatId = req.body.boatId;
        if (!boatId) throw app.httpErrors.badRequest("boatId is required");

        const pricingType = req.body.pricingType;
        if (pricingType !== "PRIVATE_HOURLY") throw app.httpErrors.badRequest("Only PRIVATE_HOURLY is supported for now");

        const rumboKey = req.body.rumbo;
        if (!rumboKey || !(rumboKey in Rumbo)) throw app.httpErrors.badRequest("rumbo is required");
        const rumbo = Rumbo[rumboKey as keyof typeof Rumbo];

        const startAt = parseDateIso(req.body.startAt);
        const endAt = parseDateIso(req.body.endAt);
        if (!startAt || !endAt) throw app.httpErrors.badRequest("startAt and endAt are required (ISO strings)");
        if (endAt <= startAt) throw app.httpErrors.badRequest("endAt must be after startAt");

        const boat = await prisma.boat.findUnique({
            where: { id: boatId },
            select: { id: true, minimumHours: true, maxPassengers: true, captain: { select: { userId: true } } }
        });
        if (!boat) throw app.httpErrors.notFound("Boat not found");

        const passengerCount = req.body.passengerCount === undefined ? 1 : Number(req.body.passengerCount);
        if (!Number.isFinite(passengerCount) || passengerCount < 1) {
            throw app.httpErrors.badRequest("passengerCount must be >= 1");
        }
        if (passengerCount > boat.maxPassengers) {
            throw app.httpErrors.badRequest(`passengerCount must be <= ${boat.maxPassengers}`);
        }

        const rumboPricing = await prisma.boatRumboPricing.findUnique({
            where: { boatId_rumbo: { boatId, rumbo } }
        });
        if (!rumboPricing) throw app.httpErrors.badRequest("Boat does not support that rumbo");

        const hours = durationHoursCeil(startAt, endAt);
        const minHours = boat.minimumHours;
        if (hours < minHours) throw app.httpErrors.badRequest(`Trip must be at least ${minHours} hours`);

        const snapshot = {
            type: "PRIVATE_HOURLY",
            rumbo,
            currency: rumboPricing.currency,
            hourlyRateCents: rumboPricing.hourlyRateCents
        };

        const baseSubtotal = rumboPricing.hourlyRateCents * hours;

        const commissionRate = 0.18;
        const commissionCents = Math.round(baseSubtotal * commissionRate);
        const totalCents = baseSubtotal + commissionCents;

        const trip = await prisma.trip.create({
            data: {
                boatId,
                createdById: payload.sub,
                status: TripStatus.REQUESTED,
                startAt,
                endAt,
                passengerCount,
                notes: req.body.notes?.trim() || null,
                pricingSnapshot: snapshot as any,
                subtotalCents: baseSubtotal,
                commissionRate,
                commissionCents,
                totalCents,
                currency: rumboPricing.currency,
                participants: { create: { userId: payload.sub } }
            },
            include: { participants: true }
        });

        await prisma.notification.create({
            data: {
                userId: boat.captain.userId,
                type: NotificationType.TRIP_REQUESTED,
                tripId: trip.id
            }
        });

        return { trip };
    });

    // (Per-person join intentionally not supported in current MVP)

    // Captain accepts/rejects
    app.post<{ Params: { id: string } }>("/trips/:id/accept", async (req) => {
        const { captain } = await requireCaptain(app, req);
        const trip = await prisma.trip.findUnique({
            where: { id: req.params.id },
            select: { id: true, boatId: true, status: true, startAt: true, endAt: true }
        });
        if (!trip) throw app.httpErrors.notFound("Trip not found");

        const boat = await prisma.boat.findUnique({ where: { id: trip.boatId }, select: { captainId: true } });
        if (!boat) throw app.httpErrors.notFound("Boat not found");
        if (boat.captainId !== captain.id) throw app.httpErrors.forbidden("Not your trip");

        if (trip.status === TripStatus.CANCELED) throw app.httpErrors.badRequest("Trip is canceled");
        if (trip.status === TripStatus.COMPLETED) throw app.httpErrors.badRequest("Trip is already completed");

        // Prevent accepting if there is already an ACCEPTED/ACTIVE overlap for this boat.
        const existingAccepted = await prisma.trip.findFirst({
            where: {
                boatId: trip.boatId,
                id: { not: trip.id },
                status: { in: [TripStatus.ACCEPTED, TripStatus.ACTIVE] },
                startAt: { lt: trip.endAt },
                endAt: { gt: trip.startAt }
            },
            select: { id: true }
        });
        if (existingAccepted) throw app.httpErrors.conflict("Boat already has an accepted trip in that time window");

        const [updated, canceled] = await prisma.$transaction([
            prisma.trip.update({
                where: { id: trip.id },
                data: { status: TripStatus.ACCEPTED }
            }),
            prisma.trip.updateMany({
                where: {
                    boatId: trip.boatId,
                    id: { not: trip.id },
                    status: TripStatus.REQUESTED,
                    startAt: { lt: trip.endAt },
                    endAt: { gt: trip.startAt }
                },
                data: { status: TripStatus.CANCELED }
            })
        ]);

        return { trip: updated, canceledConflicts: canceled.count };
    });

    app.post<{ Params: { id: string } }>("/trips/:id/reject", async (req) => {
        const { captain } = await requireCaptain(app, req);
        const trip = await prisma.trip.findUnique({ where: { id: req.params.id }, select: { id: true, boatId: true } });
        if (!trip) throw app.httpErrors.notFound("Trip not found");

        const boat = await prisma.boat.findUnique({ where: { id: trip.boatId }, select: { captainId: true } });
        if (!boat) throw app.httpErrors.notFound("Boat not found");
        if (boat.captainId !== captain.id) throw app.httpErrors.forbidden("Not your trip");

        const updated = await prisma.trip.update({
            where: { id: trip.id },
            data: { status: TripStatus.CANCELED }
        });
        return { trip: updated };
    });

    // Captain marks completed (enables reviews)
    app.post<{ Params: { id: string } }>("/trips/:id/complete", async (req) => {
        const { captain } = await requireCaptain(app, req);
        const trip = await prisma.trip.findUnique({ where: { id: req.params.id }, select: { id: true, boatId: true } });
        if (!trip) throw app.httpErrors.notFound("Trip not found");
        const boat = await prisma.boat.findUnique({ where: { id: trip.boatId }, select: { captainId: true } });
        if (!boat) throw app.httpErrors.notFound("Boat not found");
        if (boat.captainId !== captain.id) throw app.httpErrors.forbidden("Not your trip");

        const updated = await prisma.trip.update({
            where: { id: trip.id },
            data: { status: TripStatus.COMPLETED }
        });
        return { trip: updated };
    });

    // Incidents (participant or captain user)
    app.post<{ Params: { id: string }; Body: { type?: string; summary?: string } }>("/trips/:id/incidents", async (req) => {
        const payload = await requireAuthed(app, req);
        const trip = await prisma.trip.findUnique({
            where: { id: req.params.id },
            include: { boat: { include: { captain: { select: { userId: true } } } }, participants: true }
        });
        if (!trip) throw app.httpErrors.notFound("Trip not found");
        const isParticipant = trip.participants.some((p) => p.userId === payload.sub);
        const isCaptainUser = trip.boat.captain.userId === payload.sub;
        if (!isParticipant && !isCaptainUser) throw app.httpErrors.forbidden("Not your trip");

        const type = req.body.type;
        const summary = req.body.summary?.trim();
        if (!summary) throw app.httpErrors.badRequest("summary is required");
        if (!type || !(type in IncidentType)) throw app.httpErrors.badRequest("type is required");

        const incident = await prisma.incident.create({
            data: { tripId: trip.id, type: type as any, summary }
        });
        return { incident };
    });

    // Reviews (after completion)
    app.post<{ Params: { id: string }; Body: { targetType?: string; rating?: number; comment?: string } }>(
        "/trips/:id/reviews",
        async (req) => {
            const payload = await requireAuthed(app, req);
            const trip = await prisma.trip.findUnique({
                where: { id: req.params.id },
                include: { boat: { include: { captain: { select: { userId: true } } } }, participants: true }
            });
            if (!trip) throw app.httpErrors.notFound("Trip not found");
            if (trip.status !== TripStatus.COMPLETED) throw app.httpErrors.badRequest("Trip must be completed to review");

            const isParticipant = trip.participants.some((p) => p.userId === payload.sub);
            const isCaptainUser = trip.boat.captain.userId === payload.sub;
            if (!isParticipant && !isCaptainUser) throw app.httpErrors.forbidden("Not your trip");

            const targetType = req.body.targetType;
            if (!targetType || !(targetType in ReviewTargetType)) throw app.httpErrors.badRequest("targetType is required");

            const rating = Number(req.body.rating);
            if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw app.httpErrors.badRequest("rating must be 1-5");

            if (targetType === ReviewTargetType.CAPTAIN && !isParticipant) {
                throw app.httpErrors.forbidden("Only guests can review captains");
            }
            if (targetType === ReviewTargetType.GUEST && !isCaptainUser) {
                throw app.httpErrors.forbidden("Only captains can review guests");
            }

            const existing = await prisma.review.findFirst({
                where: { tripId: trip.id, authorId: payload.sub, targetType: targetType as any },
                select: { id: true }
            });
            if (existing) throw app.httpErrors.conflict("Review already submitted");

            const review = await prisma.review.create({
                data: {
                    tripId: trip.id,
                    authorId: payload.sub,
                    targetType: targetType as any,
                    rating,
                    comment: req.body.comment?.trim() || null
                }
            });
            return { review };
        }
    );

    // Stub payment: mark trip paid (guest triggers after acceptance)
    app.post<{ Params: { id: string } }>("/trips/:id/pay", async (req) => {
        const payload = await requireAuthed(app, req);
        const trip = await prisma.trip.findUnique({
            where: { id: req.params.id },
            include: { participants: true, payment: true }
        });
        if (!trip) throw app.httpErrors.notFound("Trip not found");
        const isParticipant = trip.participants.some((p) => p.userId === payload.sub);
        if (!isParticipant) throw app.httpErrors.forbidden("Not your trip");
        if (trip.status !== TripStatus.ACCEPTED) throw app.httpErrors.badRequest("Trip must be accepted before payment");

        if (trip.payment) {
            return { payment: trip.payment };
        }

        const payment = await prisma.payment.create({
            data: {
                tripId: trip.id,
                status: PaymentStatus.PAID,
                amountCents: trip.totalCents,
                currency: trip.currency,
                provider: "stub",
                providerRef: `stub_${Date.now()}`
            }
        });
        return { payment };
    });

    // Lists
    app.get("/trips/me", async (req) => {
        const payload = await requireAuthed(app, req);
        const trips = await prisma.trip.findMany({
            where: {
                OR: [{ createdById: payload.sub }, { participants: { some: { userId: payload.sub } } }]
            },
            include: {
                boat: { select: { id: true, name: true } },
                payment: true
            },
            orderBy: { createdAt: "desc" }
        });
        return { trips };
    });

    app.get("/trips/captain", async (req) => {
        const { captain } = await requireCaptain(app, req);
        const trips = await prisma.trip.findMany({
            where: { boat: { captainId: captain.id } },
            select: {
                id: true,
                status: true,
                startAt: true,
                endAt: true,
                passengerCount: true,
                notes: true,
                pricingSnapshot: true,
                currency: true,
                totalCents: true,
                boat: { select: { id: true, name: true } },
                createdBy: { select: { id: true, email: true } },
                payment: true
            },
            orderBy: { createdAt: "desc" }
        });

        return {
            trips: trips.map((t) => ({
                ...t,
                rumbo: (t.pricingSnapshot as any)?.rumbo ?? null
            }))
        };
    });
};

