import type { FastifyPluginAsync } from "fastify";
import { NotificationType, prisma } from "@lanchas/prisma";
import { requireAuthed } from "../auth/guards.js";

function truthy(v: unknown): boolean {
    if (v === true) return true;
    if (v === 1) return true;
    const s = String(v ?? "").toLowerCase();
    return s === "1" || s === "true" || s === "yes";
}

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
    app.get("/notifications/me", async (req) => {
        const payload = await requireAuthed(app, req);
        const q = (req.query ?? {}) as Record<string, unknown>;
        const unreadOnly = truthy(q.unreadOnly);
        const limit = Math.max(1, Math.min(50, Number(q.limit ?? 20) || 20));

        const [unreadCount, notifications] = await Promise.all([
            prisma.notification.count({ where: { userId: payload.sub, readAt: null } }),
            prisma.notification.findMany({
                where: { userId: payload.sub, ...(unreadOnly ? { readAt: null } : {}) },
                orderBy: { createdAt: "desc" },
                take: limit,
                include: {
                    trip: {
                        select: {
                            id: true,
                            startAt: true,
                            endAt: true,
                            passengerCount: true,
                            pricingSnapshot: true,
                            boat: { select: { id: true, name: true } },
                            createdBy: { select: { id: true, email: true } }
                        }
                    }
                }
            })
        ]);

        return {
            unreadCount,
            notifications: notifications.map((n) => ({
                id: n.id,
                type: n.type,
                createdAt: n.createdAt,
                readAt: n.readAt,
                trip: n.trip
                    ? {
                        id: n.trip.id,
                        startAt: n.trip.startAt,
                        endAt: n.trip.endAt,
                        passengerCount: n.trip.passengerCount,
                        rumbo: (n.trip.pricingSnapshot as any)?.rumbo ?? null,
                        boat: n.trip.boat,
                        createdBy: n.trip.createdBy
                    }
                    : null
            }))
        };
    });

    app.post<{ Params: { id: string } }>("/notifications/:id/read", async (req) => {
        const payload = await requireAuthed(app, req);

        const n = await prisma.notification.findUnique({
            where: { id: req.params.id },
            select: { id: true, userId: true, readAt: true }
        });
        if (!n) throw app.httpErrors.notFound("Notification not found");
        if (n.userId !== payload.sub) throw app.httpErrors.forbidden("Not yours");

        if (!n.readAt) {
            await prisma.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
        }

        return { ok: true };
    });

    // convenience: mark all as read
    app.post("/notifications/read-all", async (req) => {
        const payload = await requireAuthed(app, req);
        await prisma.notification.updateMany({
            where: { userId: payload.sub, readAt: null },
            data: { readAt: new Date() }
        });
        return { ok: true };
    });
};

