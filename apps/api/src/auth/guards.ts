import { prisma, type UserRole } from "@lanchas/prisma";
import type { FastifyInstance } from "fastify";
import type { AccessTokenPayload } from "./jwt.js";
import { requireUser } from "./jwt.js";

export async function requireAuthed(app: FastifyInstance, req: any): Promise<AccessTokenPayload> {
    return requireUser(app, req);
}

export async function requireCaptain(app: FastifyInstance, req: any) {
    const payload = await requireUser(app, req);
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { role: true } });
    if (!user) throw app.httpErrors.unauthorized("Not authenticated");
    if (user.role !== "CAPTAIN" && user.role !== "BOTH") throw app.httpErrors.forbidden("Captain access required");

    const captain = await prisma.captain.findUnique({
        where: { userId: payload.sub },
        select: { id: true, userId: true }
    });
    if (!captain) throw app.httpErrors.forbidden("Captain profile not found");
    return { payload, captain };
}

export function upgradedRoleForCaptain(current: UserRole): UserRole {
    if (current === "GUEST") return "CAPTAIN";
    if (current === "CAPTAIN") return "CAPTAIN";
    return "BOTH";
}

