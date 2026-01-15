import type { FastifyPluginAsync } from "fastify";
import { BoatPricingType, prisma } from "@lanchas/prisma";
import { requireCaptain } from "../auth/guards.js";

type CreatePricingBody = {
    type?: "PRIVATE_HOURLY" | "PER_PERSON";
    currency?: string;
    privateHourlyRateCents?: number;
    perPersonRateCents?: number;
    minimumTripDurationHours?: number;
};

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
        if (type !== "PRIVATE_HOURLY" && type !== "PER_PERSON") throw app.httpErrors.badRequest("type is required");

        const minimumTripDurationHours = Number(req.body.minimumTripDurationHours);
        if (!Number.isFinite(minimumTripDurationHours) || minimumTripDurationHours < 1) {
            throw app.httpErrors.badRequest("minimumTripDurationHours must be >= 1");
        }

        const currency = (req.body.currency?.trim() || "USD").toUpperCase();

        if (type === "PRIVATE_HOURLY") {
            const rate = Number(req.body.privateHourlyRateCents);
            if (!Number.isFinite(rate) || rate < 1) throw app.httpErrors.badRequest("privateHourlyRateCents must be >= 1");

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
        }

        const rate = Number(req.body.perPersonRateCents);
        if (!Number.isFinite(rate) || rate < 1) throw app.httpErrors.badRequest("perPersonRateCents must be >= 1");

        await prisma.boatPricing.updateMany({
            where: { boatId: req.params.id, type: BoatPricingType.PER_PERSON, activeTo: null },
            data: { activeTo: new Date() }
        });

        const pricing = await prisma.boatPricing.create({
            data: {
                boatId: req.params.id,
                type: BoatPricingType.PER_PERSON,
                currency,
                perPersonRateCents: rate,
                minimumTripDurationHours
            }
        });
        return { pricing };
    });
};

