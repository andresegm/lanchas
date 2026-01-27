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

    app.get<{ Querystring: { rumbos?: unknown; destino?: string; pax?: unknown; maxPrice?: unknown; startAt?: string; endAt?: string; limit?: unknown; offset?: unknown } }>(
        "/boats",
        async (req) => {
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

            const pax = Array.isArray(req.query.pax) ? Number(req.query.pax[0]) : Number(req.query.pax ?? NaN);
            const paxFilter = Number.isFinite(pax) && pax > 0 ? pax : null;

            const maxPrice = Array.isArray(req.query.maxPrice) ? Number(req.query.maxPrice[0]) : Number(req.query.maxPrice ?? NaN);
            const maxPriceCents = Number.isFinite(maxPrice) && maxPrice > 0 ? Math.round(maxPrice * 100) : null;

            // Build a single "some" clause so destino/maxPrice combine on the same pricing row.
            const someRumboPricing =
                rumboFilter.length > 0 || maxPriceCents !== null
                    ? {
                        ...(rumboFilter.length > 0 ? { rumbo: { in: rumboFilter } } : {}),
                        ...(maxPriceCents !== null ? { hourlyRateCents: { lte: maxPriceCents } } : {})
                    }
                    : null;

            const startAt = req.query.startAt ? new Date(req.query.startAt) : null;
            const endAt = req.query.endAt ? new Date(req.query.endAt) : null;
            const hasDateWindow =
                startAt !== null &&
                endAt !== null &&
                !Number.isNaN(startAt.getTime()) &&
                !Number.isNaN(endAt.getTime()) &&
                endAt > startAt;

            const where: any = {
                ...(paxFilter !== null ? { maxPassengers: { gte: paxFilter } } : {}),
                ...(someRumboPricing ? { rumboPricings: { some: someRumboPricing } } : {}),
                ...(hasDateWindow
                    ? {
                        trips: {
                            none: {
                                status: { in: [TripStatus.ACCEPTED, TripStatus.ACTIVE] },
                                startAt: { lt: endAt! },
                                endAt: { gt: startAt! }
                            }
                        }
                    }
                    : {})
            };

            // Pagination
            const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 20) || 20));
            const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);

            const [boats, totalCount] = await Promise.all([
                prisma.boat.findMany({
                    where: Object.keys(where).length ? where : undefined,
                    include: {
                        captain: { select: { id: true, displayName: true } },
                        pricings: { where: { activeTo: null }, orderBy: { activeFrom: "desc" } },
                        rumboPricings: { orderBy: { rumbo: "asc" } },
                        photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 5 }
                    },
                    orderBy: { createdAt: "desc" },
                    take: limit,
                    skip: offset
                }),
                prisma.boat.count({
                    where: Object.keys(where).length ? where : undefined
                })
            ]);

            // Ratings: use CAPTAIN reviews as the source of truth.
            // - Boat rating: avg rating for CAPTAIN reviews on trips for that boat
            // - Captain rating: avg rating for CAPTAIN reviews across all boats for that captain
            type BoatRatingRow = { boatId: string; avg: number | null; count: number };
            type CaptainRatingRow = { captainId: string; avg: number | null; count: number };

            const boatIds = boats.map((b) => b.id);
            const captainIds = boats.map((b) => b.captain.id);

            const [boatRatings, captainRatings] = await Promise.all([
                boatIds.length
                    ? prisma.$queryRaw<BoatRatingRow[]>`
                    SELECT t."boatId" as "boatId",
                           AVG(r."rating")::float as "avg",
                           COUNT(*)::int as "count"
                    FROM "Review" r
                    JOIN "Trip" t ON t."id" = r."tripId"
                    WHERE r."targetType" = 'CAPTAIN'
                      AND t."boatId" = ANY(${boatIds}::text[])
                    GROUP BY t."boatId"
                `
                    : Promise.resolve([] as BoatRatingRow[]),
                captainIds.length
                    ? prisma.$queryRaw<CaptainRatingRow[]>`
                    SELECT b."captainId" as "captainId",
                           AVG(r."rating")::float as "avg",
                           COUNT(*)::int as "count"
                    FROM "Review" r
                    JOIN "Trip" t ON t."id" = r."tripId"
                    JOIN "Boat" b ON b."id" = t."boatId"
                    WHERE r."targetType" = 'CAPTAIN'
                      AND b."captainId" = ANY(${captainIds}::text[])
                    GROUP BY b."captainId"
                `
                    : Promise.resolve([] as CaptainRatingRow[])
            ]);

            const boatRatingById = new Map(boatRatings.map((r) => [r.boatId, { avg: r.avg, count: r.count }]));
            const captainRatingById = new Map(captainRatings.map((r) => [r.captainId, { avg: r.avg, count: r.count }]));

            return {
                boats: boats.map((b) => ({
                    ...b,
                    rating: boatRatingById.get(b.id) ?? { avg: null, count: 0 },
                    captain: {
                        ...b.captain,
                        rating: captainRatingById.get(b.captain.id) ?? { avg: null, count: 0 }
                    }
                })),
                pagination: {
                    total: totalCount,
                    limit,
                    offset,
                    hasMore: offset + boats.length < totalCount
                }
            };
        }
    );

    app.get<{ Params: { id: string } }>("/boats/:id", async (req) => {
        const boat = await prisma.boat.findUnique({
            where: { id: req.params.id },
            include: {
                captain: { select: { id: true, displayName: true, bio: true, phone: true } },
                pricings: { where: { activeTo: null }, orderBy: { activeFrom: "desc" } },
                rumboPricings: { orderBy: { rumbo: "asc" } },
                photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 20 }
            }
        });
        if (!boat) throw app.httpErrors.notFound("Boat not found");

        type OneBoatRow = { avg: number | null; count: number };
        type OneCaptainRow = { avg: number | null; count: number };

        const [boatRating, captainRating, captainReviews] = await Promise.all([
            prisma.$queryRaw<OneBoatRow[]>`
                SELECT AVG(r."rating")::float as "avg",
                       COUNT(*)::int as "count"
                FROM "Review" r
                JOIN "Trip" t ON t."id" = r."tripId"
                WHERE r."targetType" = 'CAPTAIN'
                  AND t."boatId" = ${boat.id}
            `,
            prisma.$queryRaw<OneCaptainRow[]>`
                SELECT AVG(r."rating")::float as "avg",
                       COUNT(*)::int as "count"
                FROM "Review" r
                JOIN "Trip" t ON t."id" = r."tripId"
                JOIN "Boat" b ON b."id" = t."boatId"
                WHERE r."targetType" = 'CAPTAIN'
                  AND b."captainId" = ${boat.captain.id}
            `,
            prisma.review.findMany({
                where: {
                    trip: { boat: { captainId: boat.captain.id } },
                    targetType: "CAPTAIN"
                },
                include: {
                    author: { select: { firstName: true } },
                    trip: { select: { boat: { select: { name: true } } } }
                },
                orderBy: { createdAt: "desc" },
                take: 10
            })
        ]);

        const captainRatingData = captainRating[0] ?? { avg: null, count: 0 };
        const reviewsData = captainReviews.map((r) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            authorFirstName: r.author.firstName,
            boatName: r.trip.boat.name,
            createdAt: r.createdAt
        }));

        return {
            boat: {
                ...boat,
                rating: boatRating[0] ?? { avg: null, count: 0 },
                captain: {
                    ...boat.captain,
                    rating: captainRatingData,
                    reviews: reviewsData
                }
            }
        };
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
                    // Only block times that the captain has actually accepted (or is currently active).
                    status: { in: [TripStatus.ACCEPTED, TripStatus.ACTIVE] },
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

