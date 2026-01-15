import type { FastifyReply } from "fastify";
import { env } from "../env.js";

export const ACCESS_COOKIE = "lanchas_access";
export const REFRESH_COOKIE = "lanchas_refresh";

const base = {
    httpOnly: true,
    secure: env.AUTH_COOKIE_SECURE,
    sameSite: "lax" as const,
    path: "/"
};

export function setAccessCookie(reply: FastifyReply, token: string) {
    reply.setCookie(ACCESS_COOKIE, token, {
        ...base,
        maxAge: env.AUTH_ACCESS_TTL_SECONDS
    });
}

export function setRefreshCookie(reply: FastifyReply, token: string) {
    reply.setCookie(REFRESH_COOKIE, token, {
        ...base,
        maxAge: env.AUTH_REFRESH_TTL_SECONDS
    });
}

export function clearAuthCookies(reply: FastifyReply) {
    reply.clearCookie(ACCESS_COOKIE, { path: "/" });
    reply.clearCookie(REFRESH_COOKIE, { path: "/" });
}

