import type { FastifyPluginAsync } from "fastify";
import { BoatPricingType, Rumbo, TripStatus, prisma } from "@lanchas/prisma";
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
    const destinoToRumbo: Record<string, Rumbo> = {
        // Rumbo 1
        "las borrachas": Rumbo.RUMBO_1,
        borrachas: Rumbo.RUMBO_1,
        puinare: Rumbo.RUMBO_1,
        "el faro": Rumbo.RUMBO_1,
        faro: Rumbo.RUMBO_1,
        "el saco": Rumbo.RUMBO_1,
        saco: Rumbo.RUMBO_1,
        "bahia del silencio": Rumbo.RUMBO_1,
        "la bahia del silencio": Rumbo.RUMBO_1,
        silencio: Rumbo.RUMBO_1,

        // Rumbo 2
        "isla de plata": Rumbo.RUMBO_2,
        "plata": Rumbo.RUMBO_2,
        varadero: Rumbo.RUMBO_2,
        "punta la cruz": Rumbo.RUMBO_2,

        // Rumbo 3
        "las caracas": Rumbo.RUMBO_3,
        caracas: Rumbo.RUMBO_3,
        "playa piscina": Rumbo.RUMBO_3,
        piscina: Rumbo.RUMBO_3,
        "el tigrillo": Rumbo.RUMBO_3,
        tigrillo: Rumbo.RUMBO_3
    };

    app.get<{ Querystring: { rumbos?: unknown; destino?: string } }>("/boats", async (req) => {
        const rumbosRaw = Array.isArray(req.query.rumbos) ? req.query.rumbos.join(",") : String(req.query.rumbos ?? "");
        const rumbos = (rumbosRaw ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .filter((s): s is keyof typeof Rumbo => s in Rumbo)
            .map((s) => Rumbo[s]);

        const destino = (req.query.destino ?? "").trim().toLowerCase();
        const destinoRumbo = destino ? destinoToRumbo[destino] : undefined;

        const rumboFilter = destinoRumbo ? [destinoRumbo] : rumbos;
        const where =
            rumboFilter.length > 0
                ? {
                    rumboPricings: {
                        some: {
                            rumbo: { in: rumboFilter }
                        }
                    }
                }
                : undefined;

        const boats = await prisma.boat.findMany({
            where,
            include: {
                captain: { select: { id: true, displayName: true } },
                pricings: { where: { activeTo: null }, orderBy: { activeFrom: "desc" } },
                rumboPricings: { orderBy: { rumbo: "asc" } },
                photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 5 }
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
                pricings: { where: { activeTo: null }, orderBy: { activeFrom: "desc" } },
                rumboPricings: { orderBy: { rumbo: "asc" } },
                photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 20 }
            }
        });
        if (!boat) throw app.httpErrors.notFound("Boat not found");
        return { boat };
    });

    // Minimal availability for UI date picker:
    // - Uses existing trips to block time windows
    // - Returns a fixed horizon (default: next 30 days)
    app.get<{ Params: { id: string }; Querystring: { from?: string; to?: string } }>(
        "/boats/:id/availability",
        async (req) => {
            const boat = await prisma.boat.findUnique({
                where: { id: req.params.id },
                select: { id: true, minimumHours: true }
            });
            if (!boat) throw app.httpErrors.notFound("Boat not found");

            const now = new Date();
            const from = req.query.from ? new Date(req.query.from) : now;
            const to = req.query.to ? new Date(req.query.to) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
                throw app.httpErrors.badRequest("from/to must be ISO dates");
            }
            if (to <= from) throw app.httpErrors.badRequest("to must be after from");

            const trips = await prisma.trip.findMany({
                where: {
                    boatId: boat.id,
                    status: { in: [TripStatus.REQUESTED, TripStatus.ACCEPTED, TripStatus.ACTIVE, TripStatus.COMPLETED] },
                    startAt: { lt: to },
                    endAt: { gt: from }
                },
                select: { id: true, startAt: true, endAt: true, status: true }
            });

            return {
                boat: { id: boat.id, minimumHours: boat.minimumHours },
                blocked: trips
            };
        }
    );

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

