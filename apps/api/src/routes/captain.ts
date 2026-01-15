import type { FastifyPluginAsync } from "fastify";
import { prisma, type UserRole } from "@lanchas/prisma";
import { requireAuthed, requireCaptain, upgradedRoleForCaptain } from "../auth/guards.js";
import { setAccessCookie } from "../auth/cookies.js";
import { signAccessToken } from "../auth/jwt.js";

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

export const captainRoutes: FastifyPluginAsync = async (app) => {
    app.get("/captain/me", async (req) => {
        const payload = await requireAuthed(app, req);
        const captain = await prisma.captain.findUnique({
            where: { userId: payload.sub },
            include: {
                boats: {
                    include: {
                        pricings: { where: { activeTo: null }, orderBy: { activeFrom: "desc" } }
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
};

