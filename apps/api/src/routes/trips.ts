import type { FastifyPluginAsync } from "fastify";
import { BoatPricingType, PaymentStatus, TripStatus, prisma } from "@lanchas/prisma";
import { requireAuthed, requireCaptain } from "../auth/guards.js";

type CreateTripBody = {
    boatId?: string;
    pricingType?: "PRIVATE_HOURLY" | "PER_PERSON";
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
    // User creates a trip request (private or per-person)
    app.post<{ Body: CreateTripBody }>("/trips", async (req) => {
        const payload = await requireAuthed(app, req);

        const boatId = req.body.boatId;
        if (!boatId) throw app.httpErrors.badRequest("boatId is required");

        const pricingType = req.body.pricingType;
        if (pricingType !== "PRIVATE_HOURLY" && pricingType !== "PER_PERSON") {
            throw app.httpErrors.badRequest("pricingType is required");
        }

        const startAt = parseDateIso(req.body.startAt);
        const endAt = parseDateIso(req.body.endAt);
        if (!startAt || !endAt) throw app.httpErrors.badRequest("startAt and endAt are required (ISO strings)");
        if (endAt <= startAt) throw app.httpErrors.badRequest("endAt must be after startAt");

        const boat = await prisma.boat.findUnique({
            where: { id: boatId },
            select: { id: true, minimumHours: true, maxPassengers: true }
        });
        if (!boat) throw app.httpErrors.notFound("Boat not found");

        const activePricing = await prisma.boatPricing.findFirst({
            where: { boatId, type: pricingType as any, activeTo: null },
            orderBy: { activeFrom: "desc" }
        });
        if (!activePricing) throw app.httpErrors.badRequest("Boat has no active pricing for this type");

        const hours = durationHoursCeil(startAt, endAt);
        const minHours = Math.max(boat.minimumHours, activePricing.minimumTripDurationHours);
        if (hours < minHours) throw app.httpErrors.badRequest(`Trip must be at least ${minHours} hours`);

        const snapshot =
            pricingType === "PRIVATE_HOURLY"
                ? {
                    type: "PRIVATE_HOURLY",
                    currency: activePricing.currency,
                    privateHourlyRateCents: activePricing.privateHourlyRateCents,
                    minimumTripDurationHours: activePricing.minimumTripDurationHours
                }
                : {
                    type: "PER_PERSON",
                    currency: activePricing.currency,
                    perPersonRateCents: activePricing.perPersonRateCents,
                    minimumTripDurationHours: activePricing.minimumTripDurationHours
                };

        const baseSubtotal =
            pricingType === "PRIVATE_HOURLY"
                ? (activePricing.privateHourlyRateCents ?? 0) * hours
                : (activePricing.perPersonRateCents ?? 0) * 1;

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
                notes: req.body.notes?.trim() || null,
                pricingSnapshot: snapshot as any,
                subtotalCents: baseSubtotal,
                commissionRate,
                commissionCents,
                totalCents,
                currency: activePricing.currency,
                participants: { create: { userId: payload.sub } }
            },
            include: { participants: true }
        });

        return { trip };
    });

    // Join an existing per-person trip (updates totals using pricing snapshot)
    app.post<{ Params: { id: string } }>("/trips/:id/join", async (req) => {
        const payload = await requireAuthed(app, req);
        const trip = await prisma.trip.findUnique({
            where: { id: req.params.id },
            include: { participants: true }
        });
        if (!trip) throw app.httpErrors.notFound("Trip not found");

        const snap: any = trip.pricingSnapshot;
        if (snap?.type !== "PER_PERSON") throw app.httpErrors.badRequest("Only per-person trips can be joined");
        if (trip.status === TripStatus.CANCELED || trip.status === TripStatus.COMPLETED) {
            throw app.httpErrors.badRequest("Trip not joinable");
        }

        const exists = trip.participants.some((p) => p.userId === payload.sub);
        if (exists) return { trip };

        const boat = await prisma.boat.findUnique({ where: { id: trip.boatId }, select: { maxPassengers: true } });
        if (!boat) throw app.httpErrors.badRequest("Boat not found");
        if (trip.participants.length + 1 > boat.maxPassengers) throw app.httpErrors.badRequest("Boat is full");

        await prisma.tripParticipant.create({ data: { tripId: trip.id, userId: payload.sub } });

        const perPerson = Number(snap.perPersonRateCents ?? 0);
        const subtotalCents = perPerson * (trip.participants.length + 1);
        const commissionCents = Math.round(subtotalCents * trip.commissionRate);
        const totalCents = subtotalCents + commissionCents;

        const updated = await prisma.trip.update({
            where: { id: trip.id },
            data: { subtotalCents, commissionCents, totalCents },
            include: { participants: true }
        });
        return { trip: updated };
    });

    // Captain accepts/rejects
    app.post<{ Params: { id: string } }>("/trips/:id/accept", async (req) => {
        const { captain } = await requireCaptain(app, req);
        const trip = await prisma.trip.findUnique({ where: { id: req.params.id }, select: { id: true, boatId: true } });
        if (!trip) throw app.httpErrors.notFound("Trip not found");

        const boat = await prisma.boat.findUnique({ where: { id: trip.boatId }, select: { captainId: true } });
        if (!boat) throw app.httpErrors.notFound("Boat not found");
        if (boat.captainId !== captain.id) throw app.httpErrors.forbidden("Not your trip");

        const updated = await prisma.trip.update({
            where: { id: trip.id },
            data: { status: TripStatus.ACCEPTED }
        });
        return { trip: updated };
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
            include: {
                boat: { select: { id: true, name: true } },
                createdBy: { select: { id: true, email: true } },
                payment: true
            },
            orderBy: { createdAt: "desc" }
        });
        return { trips };
    });
};

