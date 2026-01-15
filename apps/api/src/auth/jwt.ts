import type { FastifyInstance } from "fastify";
import { env } from "../env.js";
import { ACCESS_COOKIE } from "./cookies.js";

export type AccessTokenPayload = {
    sub: string;
    role: "GUEST" | "CAPTAIN" | "BOTH";
};

export async function signAccessToken(app: FastifyInstance, payload: AccessTokenPayload): Promise<string> {
    return app.jwt.sign(payload, { expiresIn: env.AUTH_ACCESS_TTL_SECONDS });
}

export async function verifyAccessTokenFromCookie(app: FastifyInstance, cookieValue: string | undefined) {
    if (!cookieValue) return null;
    try {
        return (await app.jwt.verify(cookieValue)) as AccessTokenPayload;
    } catch {
        return null;
    }
}

export async function requireUser(app: FastifyInstance, req: any) {
    const token = req.cookies?.[ACCESS_COOKIE];
    const payload = await verifyAccessTokenFromCookie(app, token);
    if (!payload) throw app.httpErrors.unauthorized("Not authenticated");
    return payload;
}

