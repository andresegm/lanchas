import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import { env } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { captainRoutes } from "./routes/captain.js";
import { boatsRoutes } from "./routes/boats.js";
import { tripsRoutes } from "./routes/trips.js";
import { notificationsRoutes } from "./routes/notifications.js";
import { liveRidesRoutes } from "./routes/liveRides.js";

export async function buildApp() {
    const app = Fastify({
        logger: true
    });

    await app.register(sensible);

    await app.register(cors, {
        origin: env.API_CORS_ORIGIN,
        credentials: true
    });

    await app.register(cookie);

    await app.register(jwt, {
        secret: env.AUTH_JWT_SECRET
    });

    await app.register(authRoutes);
    await app.register(captainRoutes);
    await app.register(boatsRoutes);
    await app.register(tripsRoutes);
    await app.register(notificationsRoutes);
    await app.register(liveRidesRoutes);

    app.get("/health", async () => ({ ok: true }));

    return app;
}

