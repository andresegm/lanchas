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

type UpdateCaptainBody = {
    displayName?: string;
    bio?: string | null;
    phone?: string | null;
};

type LiveRidesToggleBody = {
    enabled?: boolean;
    boatId?: string;
};

function truthy(v: unknown): boolean {
    if (v === true) return true;
    if (v === false) return false;
    if (v === 1) return true;
    if (v === 0) return false;
    const s = String(v ?? "").toLowerCase().trim();
    if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
    if (s === "false" || s === "0" || s === "no" || s === "off" || s === "") return false;
    return Boolean(v);
}

type CreateBoatBody = {
    name?: string;
    maxPassengers?: number;
    minimumHours?: number;
    licenseRef?: string | null;
    insuranceRef?: string | null;
};

type UpdateBoatBody = {
    name?: string;
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

type BulkBoatRumbosBody = {
    currency?: string;
    hourlyRateRUMBO_1?: number;
    hourlyRateRUMBO_2?: number;
    hourlyRateRUMBO_3?: number;
    hourlyRateCentsRUMBO_1?: number;
    hourlyRateCentsRUMBO_2?: number;
    hourlyRateCentsRUMBO_3?: number;
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

    // Captain updates profile (displayName, bio, phone)
    app.post<{ Body: UpdateCaptainBody }>("/captain/me", async (req) => {
        const { captain } = await requireCaptain(app, req);
        const displayName = req.body.displayName?.trim();
        if (!displayName) throw app.httpErrors.badRequest("displayName is required");

        const updated = await prisma.captain.update({
            where: { id: captain.id },
            data: {
                displayName,
                bio: req.body.bio === undefined ? undefined : req.body.bio ? String(req.body.bio).trim() : null,
                phone: req.body.phone === undefined ? undefined : req.body.phone ? String(req.body.phone).trim() : null
            }
        });
        return { captain: updated };
    });

    // Captain toggles live rides availability for a specific boat
    app.post<{ Body: LiveRidesToggleBody }>("/captain/me/live-rides", async (req) => {
        const { captain } = await requireCaptain(app, req);
        const enabled = truthy((req.body as any).enabled);
        const boatId = String((req.body as any).boatId ?? "").trim();
        if (!boatId) throw app.httpErrors.badRequest("boatId is required");

        // Verify the boat belongs to this captain
        const boat = await prisma.boat.findUnique({
            where: { id: boatId },
            select: { id: true, captainId: true }
        });
        if (!boat) throw app.httpErrors.notFound("Boat not found");
        if (boat.captainId !== captain.id) throw app.httpErrors.forbidden("Not your boat");

        const updated = await prisma.boat.update({
            where: { id: boatId },
            data: { liveRidesOn: enabled },
            select: { id: true, name: true, liveRidesOn: true }
        });
        return { boat: updated };
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

    // Captain updates a boat (currently: name only)
    app.post<{ Params: { boatId: string }; Body: UpdateBoatBody }>("/captain/boats/:boatId", async (req) => {
        const { captain } = await requireCaptain(app, req);
        const boat = await prisma.boat.findUnique({ where: { id: req.params.boatId }, select: { id: true, captainId: true } });
        if (!boat) throw app.httpErrors.notFound("Boat not found");
        if (boat.captainId !== captain.id) throw app.httpErrors.forbidden("Not your boat");

        const name = req.body.name?.trim();
        if (!name) throw app.httpErrors.badRequest("name is required");

        const updated = await prisma.boat.update({
            where: { id: boat.id },
            data: { name }
        });
        return { boat: updated };
    });

    app.post<{ Params: { boatId: string }; Body: AddBoatPhotoBody }>("/captain/boats/:boatId/photos", async (req) => {
        const { captain } = await requireCaptain(app, req);
        const boat = await prisma.boat.findUnique({ where: { id: req.params.boatId }, select: { captainId: true } });
        if (!boat) throw app.httpErrors.notFound("Boat not found");
        if (boat.captainId !== captain.id) throw app.httpErrors.forbidden("Not your boat");

        const url = req.body.url?.trim();
        if (!url) throw app.httpErrors.badRequest("url is required");
        if (!/^https?:\/\//i.test(url)) throw app.httpErrors.badRequest("url must be http(s)");

        const providedSortOrder = req.body.sortOrder === undefined ? null : Number(req.body.sortOrder);
        if (providedSortOrder !== null && (!Number.isFinite(providedSortOrder) || providedSortOrder < 0)) {
            throw app.httpErrors.badRequest("sortOrder must be >= 0");
        }

        const photo = await prisma.$transaction(async (tx) => {
            // default: append after existing photos, keeping the first (sortOrder=0) as main
            if (providedSortOrder === null) {
                const agg = await tx.boatPhoto.aggregate({
                    where: { boatId: req.params.boatId },
                    _max: { sortOrder: true }
                });
                const sortOrder = (agg._max.sortOrder ?? -1) + 1;
                return tx.boatPhoto.create({ data: { boatId: req.params.boatId, url, sortOrder } });
            }

            // If explicitly setting as main, bump all existing photos down and insert at 0.
            if (providedSortOrder === 0) {
                await tx.boatPhoto.updateMany({
                    where: { boatId: req.params.boatId },
                    data: { sortOrder: { increment: 1 } }
                });
                return tx.boatPhoto.create({ data: { boatId: req.params.boatId, url, sortOrder: 0 } });
            }

            return tx.boatPhoto.create({ data: { boatId: req.params.boatId, url, sortOrder: providedSortOrder } });
        });

        return { photo };
    });

    // Make an existing photo the main photo (sortOrder=0)
    app.post<{ Params: { boatId: string; photoId: string } }>("/captain/boats/:boatId/photos/:photoId/main", async (req) => {
        const { captain } = await requireCaptain(app, req);
        const boat = await prisma.boat.findUnique({ where: { id: req.params.boatId }, select: { captainId: true } });
        if (!boat) throw app.httpErrors.notFound("Boat not found");
        if (boat.captainId !== captain.id) throw app.httpErrors.forbidden("Not your boat");

        const photo = await prisma.boatPhoto.findUnique({ where: { id: req.params.photoId }, select: { id: true, boatId: true } });
        if (!photo || photo.boatId !== req.params.boatId) throw app.httpErrors.notFound("Photo not found");

        await prisma.$transaction(async (tx) => {
            await tx.boatPhoto.updateMany({
                where: { boatId: req.params.boatId, id: { not: req.params.photoId } },
                data: { sortOrder: { increment: 1 } }
            });
            await tx.boatPhoto.update({ where: { id: req.params.photoId }, data: { sortOrder: 0 } });
        });

        return { ok: true };
    });

    // Delete a photo (and re-normalize ordering so the lowest becomes main)
    app.post<{ Params: { boatId: string; photoId: string } }>("/captain/boats/:boatId/photos/:photoId/delete", async (req) => {
        const { captain } = await requireCaptain(app, req);
        const boat = await prisma.boat.findUnique({ where: { id: req.params.boatId }, select: { captainId: true } });
        if (!boat) throw app.httpErrors.notFound("Boat not found");
        if (boat.captainId !== captain.id) throw app.httpErrors.forbidden("Not your boat");

        const photo = await prisma.boatPhoto.findUnique({
            where: { id: req.params.photoId },
            select: { id: true, boatId: true }
        });
        if (!photo || photo.boatId !== req.params.boatId) throw app.httpErrors.notFound("Photo not found");

        await prisma.$transaction(async (tx) => {
            await tx.boatPhoto.delete({ where: { id: req.params.photoId } });

            const remaining = await tx.boatPhoto.findMany({
                where: { boatId: req.params.boatId },
                orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
            });

            // compact to 0..n so we always have a clear "main"
            await Promise.all(
                remaining.map((p, idx) => tx.boatPhoto.update({ where: { id: p.id }, data: { sortOrder: idx } }))
            );
        });

        return { ok: true };
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

    // Bulk upsert all 3 rumbos in one request (captain UI).
    // Any rumo with missing/<=0 rate will be deleted (treated as "not supported").
    app.post<{ Params: { boatId: string }; Body: BulkBoatRumbosBody }>(
        "/captain/boats/:boatId/rumbos/bulk",
        async (req) => {
            const { captain } = await requireCaptain(app, req);
            const boat = await prisma.boat.findUnique({ where: { id: req.params.boatId }, select: { captainId: true } });
            if (!boat) throw app.httpErrors.notFound("Boat not found");
            if (boat.captainId !== captain.id) throw app.httpErrors.forbidden("Not your boat");

            const currency = (req.body.currency?.trim() || "USD").toUpperCase();

            const entries: Array<{
                rumbo: Rumbo;
                dollars?: unknown;
                cents?: unknown;
            }> = [
                    { rumbo: Rumbo.RUMBO_1, dollars: req.body.hourlyRateRUMBO_1, cents: req.body.hourlyRateCentsRUMBO_1 },
                    { rumbo: Rumbo.RUMBO_2, dollars: req.body.hourlyRateRUMBO_2, cents: req.body.hourlyRateCentsRUMBO_2 },
                    { rumbo: Rumbo.RUMBO_3, dollars: req.body.hourlyRateRUMBO_3, cents: req.body.hourlyRateCentsRUMBO_3 }
                ];

            const ops = entries.map((e) => {
                const rateCents =
                    e.dollars !== undefined && e.dollars !== null && e.dollars !== ("" as any)
                        ? dollarsToCents(e.dollars)
                        : e.cents !== undefined && e.cents !== null && e.cents !== ("" as any)
                            ? Math.round(Number(e.cents))
                            : null;

                if (!rateCents || rateCents <= 0) {
                    return prisma.boatRumboPricing.deleteMany({ where: { boatId: req.params.boatId, rumbo: e.rumbo } });
                }

                return prisma.boatRumboPricing.upsert({
                    where: { boatId_rumbo: { boatId: req.params.boatId, rumbo: e.rumbo } },
                    update: { hourlyRateCents: rateCents, currency },
                    create: { boatId: req.params.boatId, rumbo: e.rumbo, hourlyRateCents: rateCents, currency }
                });
            });

            await prisma.$transaction(ops);
            const rumboPricings = await prisma.boatRumboPricing.findMany({
                where: { boatId: req.params.boatId },
                orderBy: { rumbo: "asc" }
            });
            return { rumboPricings };
        }
    );
};

