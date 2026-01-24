"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

type Notif = {
    id: string;
    type: string;
    readAt: string | null;
    trip: null | { boat: { name: string }; passengerCount: number; rumbo: string | null; createdBy: { email: string } };
};

type NotificationsMeResponse = { unreadCount: number; notifications: Notif[] };

function makeTitle(n: Notif) {
    if (n.type === "TRIP_REQUESTED") return "New trip request";
    return n.type;
}

function makeBody(n: Notif) {
    if (!n.trip) return "";
    const parts = [
        n.trip.boat.name,
        n.trip.rumbo ?? undefined,
        `${n.trip.passengerCount} pax`,
        n.trip.createdBy.email
    ].filter(Boolean);
    return parts.join(" • ");
}

export function NotificationsClient({ initialUnread, initialTopUnreadId }: { initialUnread: number; initialTopUnreadId: string | null }) {
    const [permission, setPermission] = useState<NotificationPermission>(() => {
        if (typeof window === "undefined" || !("Notification" in window)) return "default";
        return Notification.permission;
    });

    const lastSeenRef = useRef<string | null>(initialTopUnreadId);
    const initialUnreadRef = useRef<number>(initialUnread);

    const supports = useMemo(() => typeof window !== "undefined" && "Notification" in window, []);

    useEffect(() => {
        if (!supports) return;
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
                    // only notify if user has granted permission
                    if (Notification.permission === "granted") {
                        new Notification(makeTitle(top), { body: makeBody(top) });
                    }
                }

                // reset initial unread baseline after first poll to avoid stale assumptions
                if (initialUnreadRef.current !== data.unreadCount) {
                    initialUnreadRef.current = data.unreadCount;
                }
            } catch {
                // ignore
            }
        }, 20000);
        return () => window.clearInterval(id);
    }, [supports]);

    if (!supports) return null;

    return (
        <div className={styles.browserNotifRow}>
            <div className={styles.meta}>
                Browser notifications: <strong>{permission === "granted" ? "On" : permission === "denied" ? "Blocked" : "Off"}</strong>
            </div>
            {permission !== "granted" ? (
                <button
                    className={styles.secondary}
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
            ) : null}
        </div>
    );
}

