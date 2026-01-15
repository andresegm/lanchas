import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@lanchas/prisma";
import { env } from "../env.js";
import { clearAuthCookies, REFRESH_COOKIE, setAccessCookie, setRefreshCookie } from "../auth/cookies.js";
import { hashPassword, randomToken, sha256Base64Url, verifyPassword } from "../auth/crypto.js";
import { requireUser, signAccessToken } from "../auth/jwt.js";

type AuthBody = { email?: string; password?: string };

function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

export const authRoutes: FastifyPluginAsync = async (app) => {
    app.post<{ Body: AuthBody }>("/auth/register", async (req, reply) => {
        const emailRaw = req.body.email;
        const password = req.body.password;
        if (!emailRaw || !password) throw app.httpErrors.badRequest("Email and password are required");
        if (password.length < 8) throw app.httpErrors.badRequest("Password must be at least 8 characters");

        const email = normalizeEmail(emailRaw);
        const passwordHash = await hashPassword(password);

        const user = await prisma.user.create({
            data: { email, passwordHash, role: "GUEST" },
            select: { id: true, role: true, email: true }
        });

        const access = await signAccessToken(app, { sub: user.id, role: user.role });
        const refreshPlain = randomToken(32);
        const refreshHash = sha256Base64Url(refreshPlain);
        const expiresAt = new Date(Date.now() + env.AUTH_REFRESH_TTL_SECONDS * 1000);

        await prisma.refreshToken.create({
            data: { userId: user.id, tokenHash: refreshHash, expiresAt }
        });

        setAccessCookie(reply, access);
        setRefreshCookie(reply, refreshPlain);
        return reply.send({ user: { id: user.id, email: user.email, role: user.role } });
    });

    app.post<{ Body: AuthBody }>("/auth/login", async (req, reply) => {
        const emailRaw = req.body.email;
        const password = req.body.password;
        if (!emailRaw || !password) throw app.httpErrors.badRequest("Email and password are required");

        const email = normalizeEmail(emailRaw);
        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, email: true, role: true, passwordHash: true }
        });
        if (!user) throw app.httpErrors.unauthorized("Invalid credentials");

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) throw app.httpErrors.unauthorized("Invalid credentials");

        const access = await signAccessToken(app, { sub: user.id, role: user.role });
        const refreshPlain = randomToken(32);
        const refreshHash = sha256Base64Url(refreshPlain);
        const expiresAt = new Date(Date.now() + env.AUTH_REFRESH_TTL_SECONDS * 1000);

        await prisma.refreshToken.create({
            data: { userId: user.id, tokenHash: refreshHash, expiresAt }
        });

        setAccessCookie(reply, access);
        setRefreshCookie(reply, refreshPlain);
        return reply.send({ user: { id: user.id, email: user.email, role: user.role } });
    });

    app.post("/auth/refresh", async (req, reply) => {
        const refreshPlain: string | undefined = (req.cookies as any)?.[REFRESH_COOKIE];
        if (!refreshPlain) throw app.httpErrors.unauthorized("Missing refresh token");

        const now = new Date();
        const refreshHash = sha256Base64Url(refreshPlain);
        const existing = await prisma.refreshToken.findUnique({
            where: { tokenHash: refreshHash },
            select: { id: true, userId: true, revokedAt: true, expiresAt: true }
        });
        if (!existing || existing.revokedAt || existing.expiresAt <= now) {
            throw app.httpErrors.unauthorized("Invalid refresh token");
        }

        const user = await prisma.user.findUnique({
            where: { id: existing.userId },
            select: { id: true, email: true, role: true }
        });
        if (!user) throw app.httpErrors.unauthorized("Invalid refresh token");

        // Rotate refresh token
        const newRefreshPlain = randomToken(32);
        const newRefreshHash = sha256Base64Url(newRefreshPlain);
        const newExpiresAt = new Date(Date.now() + env.AUTH_REFRESH_TTL_SECONDS * 1000);

        const created = await prisma.refreshToken.create({
            data: { userId: user.id, tokenHash: newRefreshHash, expiresAt: newExpiresAt },
            select: { id: true }
        });

        await prisma.refreshToken.update({
            where: { id: existing.id },
            data: { revokedAt: now, replacedBy: created.id }
        });

        const access = await signAccessToken(app, { sub: user.id, role: user.role });
        setAccessCookie(reply, access);
        setRefreshCookie(reply, newRefreshPlain);
        return reply.send({ ok: true });
    });

    app.post("/auth/logout", async (req, reply) => {
        const refreshPlain: string | undefined = (req.cookies as any)?.[REFRESH_COOKIE];
        if (refreshPlain) {
            const refreshHash = sha256Base64Url(refreshPlain);
            await prisma.refreshToken.updateMany({
                where: { tokenHash: refreshHash, revokedAt: null },
                data: { revokedAt: new Date() }
            });
        }
        clearAuthCookies(reply);
        return reply.send({ ok: true });
    });

    app.get("/auth/me", async (req) => {
        const payload = await requireUser(app, req);
        const user = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, email: true, role: true, createdAt: true }
        });
        if (!user) throw app.httpErrors.unauthorized("Not authenticated");
        return { user };
    });
};

