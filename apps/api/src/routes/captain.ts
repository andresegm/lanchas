import type { FastifyPluginAsync } from "fastify";
import { Rumbo, prisma, type UserRole } from "@lanchas/prisma";
import { requireAuthed, requireCaptain, upgradedRoleForCaptain } from "../auth/guards.js";
import { setAccessCookie } from "../auth/cookies.js";
import { signAccessToken } from "../auth/jwt.js";
import { dollarsToCents } from "../money.js";

type CreateCaptainBody = {
    displayName?: string;
    bio?: string;
    phone?: string;
};

type CreateBoatBody = {
    name?: string;
    maxPassengers?: number;
    minimumHours?: number;
    licenseRef?: string | null;
    insuranceRef?: string | null;
};

type AddBoatPhotoBody = {
    url?: string;
    sortOrder?: number;
};

type UpsertBoatRumboBody = {
    rumbo?: string;
    hourlyRate?: number; // dollars
    hourlyRateCents?: number; // back-compat
    currency?: string;
};

export const captainRoutes: FastifyPluginAsync = async (app) => {
    app.get("/captain/me", async (req) => {
        const payload = await requireAuthed(app, req);
        const captain = await prisma.captain.findUnique({
            where: { userId: payload.sub },
            include: {
                boats: {
                    include: {
                        pricings: { where: { activeTo: null }, orderBy: { activeFrom: "desc" } },
                        rumboPricings: { orderBy: { rumbo: "asc" } },
                        photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 20 }
                    },
                    orderBy: { createdAt: "desc" }
                }
            }
        });
        return { captain };
    });

    app.post<{ Body: CreateCaptainBody }>("/captain", async (req, reply) => {
        const payload = await requireAuthed(app, req);
        const displayName = req.body.displayName?.trim();
        if (!displayName) throw app.httpErrors.badRequest("displayName is required");

        const existing = await prisma.captain.findUnique({ where: { userId: payload.sub }, select: { id: true } });
        if (existing) throw app.httpErrors.conflict("Captain profile already exists");

        const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { role: true } });
        if (!user) throw app.httpErrors.unauthorized("Not authenticated");

        const role: UserRole = upgradedRoleForCaptain(user.role);

        const captain = await prisma.captain.create({
            data: {
                userId: payload.sub,
                displayName,
                bio: req.body.bio?.trim() || null,
                phone: req.body.phone?.trim() || null
            }
        });

        await prisma.user.update({ where: { id: payload.sub }, data: { role } });
        // refresh access token so UI immediately reflects role (nav) without requiring re-login
        const access = await signAccessToken(app, { sub: payload.sub, role: role as any });
        setAccessCookie(reply, access);
        return { captain };
    });

    app.post<{ Body: CreateBoatBody }>("/captain/boats", async (req) => {
        const { captain } = await requireCaptain(app, req);

        const name = req.body.name?.trim();
        if (!name) throw app.httpErrors.badRequest("name is required");

        const maxPassengers = Number(req.body.maxPassengers);
        const minimumHours = Number(req.body.minimumHours);
        if (!Number.isFinite(maxPassengers) || maxPassengers < 1) {
            throw app.httpErrors.badRequest("maxPassengers must be >= 1");
        }
        if (!Number.isFinite(minimumHours) || minimumHours < 1) {
            throw app.httpErrors.badRequest("minimumHours must be >= 1");
        }

        const boat = await prisma.boat.create({
            data: {
                captainId: captain.id,
                name,
                maxPassengers,
                minimumHours,
                licenseRef: req.body.licenseRef?.trim() || null,
                insuranceRef: req.body.insuranceRef?.trim() || null
            }
        });
        return { boat };
    });

    app.post<{ Params: { boatId: string }; Body: AddBoatPhotoBody }>("/captain/boats/:boatId/photos", async (req) => {
        const { captain } = await requireCaptain(app, req);
        const boat = await prisma.boat.findUnique({ where: { id: req.params.boatId }, select: { captainId: true } });
        if (!boat) throw app.httpErrors.notFound("Boat not found");
        if (boat.captainId !== captain.id) throw app.httpErrors.forbidden("Not your boat");

        const url = req.body.url?.trim();
        if (!url) throw app.httpErrors.badRequest("url is required");
        if (!/^https?:\/\//i.test(url)) throw app.httpErrors.badRequest("url must be http(s)");

        const sortOrder = req.body.sortOrder === undefined ? 0 : Number(req.body.sortOrder);
        if (!Number.isFinite(sortOrder) || sortOrder < 0) throw app.httpErrors.badRequest("sortOrder must be >= 0");

        const photo = await prisma.boatPhoto.create({
            data: { boatId: req.params.boatId, url, sortOrder }
        });
        return { photo };
    });

    // Upsert or remove a boat's per-rumbo hourly pricing.
    // - If hourlyRate/hourlyRateCents is missing/<=0 -> remove the rumbo (unsupported)
    // - Otherwise upsert the rate
    app.post<{ Params: { boatId: string }; Body: UpsertBoatRumboBody }>("/captain/boats/:boatId/rumbos", async (req) => {
        const { captain } = await requireCaptain(app, req);
        const boat = await prisma.boat.findUnique({ where: { id: req.params.boatId }, select: { captainId: true } });
        if (!boat) throw app.httpErrors.notFound("Boat not found");
        if (boat.captainId !== captain.id) throw app.httpErrors.forbidden("Not your boat");

        const rumboKey = req.body.rumbo;
        if (!rumboKey || !(rumboKey in Rumbo)) throw app.httpErrors.badRequest("rumbo is required");
        const rumbo = Rumbo[rumboKey as keyof typeof Rumbo];

        const currency = (req.body.currency?.trim() || "USD").toUpperCase();
        const rateCents =
            req.body.hourlyRate !== undefined && req.body.hourlyRate !== null && req.body.hourlyRate !== ("" as any)
                ? dollarsToCents(req.body.hourlyRate)
                : req.body.hourlyRateCents !== undefined && req.body.hourlyRateCents !== null && req.body.hourlyRateCents !== ("" as any)
                    ? Math.round(Number(req.body.hourlyRateCents))
                    : null;

        if (!rateCents || rateCents <= 0) {
            await prisma.boatRumboPricing.deleteMany({ where: { boatId: req.params.boatId, rumbo } });
            return { removed: true };
        }

        const pricing = await prisma.boatRumboPricing.upsert({
            where: { boatId_rumbo: { boatId: req.params.boatId, rumbo } },
            update: { hourlyRateCents: rateCents, currency },
            create: { boatId: req.params.boatId, rumbo, hourlyRateCents: rateCents, currency }
        });
        return { pricing };
    });
};

