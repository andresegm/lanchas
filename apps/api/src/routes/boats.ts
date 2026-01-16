import type { FastifyPluginAsync } from "fastify";
import { BoatPricingType, prisma } from "@lanchas/prisma";
import { requireCaptain } from "../auth/guards.js";

type CreatePricingBody = {
    type?: "PRIVATE_HOURLY";
    currency?: string;
    // preferred (dollars)
    privateHourlyRate?: number;
    // backwards-compat (cents)
    privateHourlyRateCents?: number;
    minimumTripDurationHours?: number;
};

function pickRateCents(opts: { dollars?: unknown; cents?: unknown }) {
    if (opts.dollars !== undefined && opts.dollars !== null && opts.dollars !== "") {
        const n = Number(opts.dollars);
        if (!Number.isFinite(n)) return null;
        return Math.round(n * 100);
    }
    if (opts.cents !== undefined && opts.cents !== null && opts.cents !== "") {
        const n = Number(opts.cents);
        if (!Number.isFinite(n)) return null;
        return Math.round(n);
    }
    return null;
}

export const boatsRoutes: FastifyPluginAsync = async (app) => {
    app.get("/boats", async () => {
        const boats = await prisma.boat.findMany({
            include: {
                captain: { select: { id: true, displayName: true } },
                pricings: { where: { activeTo: null }, orderBy: { activeFrom: "desc" } }
            },
            orderBy: { createdAt: "desc" }
        });
        return { boats };
    });

    app.get<{ Params: { id: string } }>("/boats/:id", async (req) => {
        const boat = await prisma.boat.findUnique({
            where: { id: req.params.id },
            include: {
                captain: { select: { id: true, displayName: true } },
                pricings: { where: { activeTo: null }, orderBy: { activeFrom: "desc" } }
            }
        });
        if (!boat) throw app.httpErrors.notFound("Boat not found");
        return { boat };
    });

    app.post<{ Params: { id: string }; Body: CreatePricingBody }>("/boats/:id/pricing", async (req) => {
        const { captain } = await requireCaptain(app, req);
        const boat = await prisma.boat.findUnique({ where: { id: req.params.id }, select: { captainId: true } });
        if (!boat) throw app.httpErrors.notFound("Boat not found");
        if (boat.captainId !== captain.id) throw app.httpErrors.forbidden("Not your boat");

        const type = req.body.type;
        if (type !== "PRIVATE_HOURLY") throw app.httpErrors.badRequest("Only PRIVATE_HOURLY is supported for now");

        const minimumTripDurationHours = Number(req.body.minimumTripDurationHours);
        if (!Number.isFinite(minimumTripDurationHours) || minimumTripDurationHours < 1) {
            throw app.httpErrors.badRequest("minimumTripDurationHours must be >= 1");
        }

        const currency = (req.body.currency?.trim() || "USD").toUpperCase();

        const rate = pickRateCents({ dollars: req.body.privateHourlyRate, cents: req.body.privateHourlyRateCents });
        if (rate === null || rate < 1) throw app.httpErrors.badRequest("privateHourlyRate (dollars) is required");

        await prisma.boatPricing.updateMany({
            where: { boatId: req.params.id, type: BoatPricingType.PRIVATE_HOURLY, activeTo: null },
            data: { activeTo: new Date() }
        });

        const pricing = await prisma.boatPricing.create({
            data: {
                boatId: req.params.id,
                type: BoatPricingType.PRIVATE_HOURLY,
                currency,
                privateHourlyRateCents: rate,
                minimumTripDurationHours
            }
        });
        return { pricing };
    });
};

