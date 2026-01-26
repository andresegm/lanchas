"use client";

import { useEffect, useMemo, useState } from "react";
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

    const supports = useMemo(() => typeof window !== "undefined" && "Notification" in window, []);

    // Sync permission state when it changes (e.g., user enables in browser settings)
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

    // Note: BrowserNotifications (in layout.tsx) handles system notifications globally.
    // This component only displays the status and enable button.
    // No polling/notification creation here to avoid duplicates.

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

