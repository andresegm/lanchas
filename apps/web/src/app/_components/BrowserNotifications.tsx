"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./browserNotifications.module.css";

type MeResponse = { user: { email: string; role: string } };
type Notif = {
    id: string;
    type: string;
    trip: null | { boat: { name: string }; passengerCount: number; rumbo: string | null; createdBy: { email: string } };
    liveRide?: null | { pickupPoint: string; rumbo: string; passengerCount: number; hours: number; createdBy: { email: string } };
};
type NotificationsMeResponse = { unreadCount: number; notifications: Notif[] };

function isCaptainRole(role: string | undefined) {
    return role === "CAPTAIN" || role === "BOTH";
}

function makeTitle(n: Notif) {
    if (n.type === "TRIP_REQUESTED") return "New trip request";
    if (n.type === "LIVE_RIDE_OFFER") return "Live ride request";
    return n.type;
}

function makeBody(n: Notif) {
    if (n.liveRide) {
        const parts = [
            n.liveRide.pickupPoint,
            n.liveRide.rumbo ?? undefined,
            `${n.liveRide.passengerCount} pax`,
            `${n.liveRide.hours}h`,
            n.liveRide.createdBy.email
        ].filter(Boolean);
        return parts.join(" • ");
    }
    if (n.trip) {
        const parts = [n.trip.boat.name, n.trip.rumbo ?? undefined, `${n.trip.passengerCount} pax`, n.trip.createdBy.email].filter(Boolean);
        return parts.join(" • ");
    }
    return "";
}

export function BrowserNotifications() {
    const supports = typeof window !== "undefined" && "Notification" in window;
    const [role, setRole] = useState<string | null>(null);
    const [permission, setPermission] = useState<NotificationPermission>("default");
    const [dismissed, setDismissed] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        return window.localStorage.getItem("lanchas_notif_dismissed") === "1";
    });

    const lastSeenRef = useRef<string | null>(null);

    // Sync current browser permission (e.g. user enabled in browser settings)
    useEffect(() => {
        if (!supports) return;
        const sync = () => setPermission(Notification.permission);
        sync();
        window.addEventListener("focus", sync);
        document.addEventListener("visibilitychange", sync);
        return () => {
            window.removeEventListener("focus", sync);
            document.removeEventListener("visibilitychange", sync);
        };
    }, [supports]);

    // Determine if authed + captain
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/auth/me", { cache: "no-store" });
                if (!res.ok) {
                    if (!cancelled) setRole(null);
                    return;
                }
                const data = (await res.json()) as MeResponse;
                if (!cancelled) setRole(data.user.role);
            } catch {
                if (!cancelled) setRole(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Poll notifications and show system notifications when enabled
    useEffect(() => {
        if (!supports) return;
        if (!isCaptainRole(role ?? undefined)) return;

        const id = window.setInterval(async () => {
            try {
                const res = await fetch("/api/notifications/me?unreadOnly=1&limit=1", { cache: "no-store" });
                if (!res.ok) return;
                const data = (await res.json()) as NotificationsMeResponse;
                const top = data.notifications?.[0] ?? null;
                if (!top) return;

                const isNew = lastSeenRef.current !== top.id;
                if (isNew) {
                    lastSeenRef.current = top.id;
                    if (Notification.permission === "granted") {
                        new Notification(makeTitle(top), { body: makeBody(top) });
                    }
                }
            } catch {
                // ignore
            }
        }, 20000);

        return () => window.clearInterval(id);
    }, [supports, role]);

    if (!supports) return null;
    if (!isCaptainRole(role ?? undefined)) return null;
    if (permission === "granted") return null;
    if (dismissed) return null;

    return (
        <div className={styles.wrap} role="status" aria-label="Enable browser notifications">
            <div className={styles.text}>
                <div className={styles.title}>Enable browser notifications?</div>
                <div className={styles.meta}>Get a system alert when you receive a new trip request.</div>
            </div>
            <div className={styles.actions}>
                <button
                    className={styles.primary}
                    type="button"
                    onClick={async () => {
                        try {
                            const p = await Notification.requestPermission();
                            setPermission(p);
                        } catch {
                            // ignore
                        }
                    }}
                >
                    Enable
                </button>
                <button
                    className={styles.secondary}
                    type="button"
                    onClick={() => {
                        setDismissed(true);
                        window.localStorage.setItem("lanchas_notif_dismissed", "1");
                    }}
                >
                    Not now
                </button>
            </div>
        </div>
    );
}

