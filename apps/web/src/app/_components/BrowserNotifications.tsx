"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./browserNotifications.module.css";

type MeResponse = { user: { email: string; role: string } };
type CaptainMeResponse = { captain: null | { boats: Array<{ liveRidesOn: boolean }> } };
type Notif = {
    id: string;
    type: string;
    trip: null | { boat: { name: string }; passengerCount: number; rumbo: string | null; createdBy: { firstName: string | null } };
    liveRide?: null | { id: string; pickupPoint: string; rumbo: string; passengerCount: number; hours: number; createdBy: { firstName: string | null } };
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
            n.liveRide.createdBy.firstName ?? "Guest"
        ].filter(Boolean);
        return parts.join(" • ");
    }
    if (n.trip) {
        const parts = [n.trip.boat.name, n.trip.rumbo ?? undefined, `${n.trip.passengerCount} pax`, n.trip.createdBy.firstName ?? "Guest"].filter(Boolean);
        return parts.join(" • ");
    }
    return "";
}

export function BrowserNotifications() {
    const supports = typeof window !== "undefined" && "Notification" in window;
    const [role, setRole] = useState<string | null>(null);
    const [liveOn, setLiveOn] = useState<boolean>(false);
    const [permission, setPermission] = useState<NotificationPermission>("default");
    const [dismissed, setDismissed] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        return window.localStorage.getItem("lanchas_notif_dismissed") === "1";
    });

    const lastSeenRef = useRef<string | null>(null);
    const [offerModal, setOfferModal] = useState<null | { notificationId: string; offer: Notif }>(null);
    const inFlightRef = useRef(false);

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

    // Load captain live rides toggle (so we only popup when any boat has live rides enabled)
    useEffect(() => {
        if (!supports) return;
        if (!isCaptainRole(role ?? undefined)) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/captain/me", { cache: "no-store" });
                if (!res.ok) return;
                const data = (await res.json()) as CaptainMeResponse;
                // Check if any boat has live rides enabled
                const anyBoatLiveOn = data.captain?.boats?.some((b) => b.liveRidesOn) ?? false;
                if (!cancelled) setLiveOn(anyBoatLiveOn);
            } catch {
                // ignore
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [supports, role]);

    // Poll notifications and show system notifications when enabled
    useEffect(() => {
        if (!supports) {
            console.log("[BrowserNotifications] Notifications not supported");
            return;
        }
        if (!isCaptainRole(role ?? undefined)) {
            console.log("[BrowserNotifications] Not a captain role:", role);
            return;
        }

        console.log("[BrowserNotifications] Starting notification polling, role:", role, "liveOn:", liveOn);

        // Initial check immediately, then poll
        const checkNotifications = async () => {
            try {
                const res = await fetch("/api/notifications/me?unreadOnly=1&limit=1", { cache: "no-store" });
                if (!res.ok) {
                    console.log("[BrowserNotifications] Failed to fetch notifications:", res.status);
                    return;
                }
                const data = (await res.json()) as NotificationsMeResponse;
                const top = data.notifications?.[0] ?? null;
                if (!top) {
                    console.log("[BrowserNotifications] No unread notifications");
                    return;
                }

                console.log("[BrowserNotifications] Found notification:", top.type, top);

                const isNew = lastSeenRef.current !== top.id;
                if (isNew) {
                    console.log("[BrowserNotifications] New notification detected:", top.id, "type:", top.type);
                    lastSeenRef.current = top.id;

                    // Show browser notification if permission granted
                    if (Notification.permission === "granted") {
                        try {
                            console.log("[BrowserNotifications] Showing browser notification");
                            new Notification(makeTitle(top), { body: makeBody(top) });
                        } catch (err) {
                            console.error("[BrowserNotifications] Failed to show browser notification:", err);
                        }
                    } else {
                        console.log("[BrowserNotifications] Browser notification permission not granted:", Notification.permission);
                    }

                    // Always show modal for live ride offers, regardless of liveOn state
                    // The notification itself is proof the captain was offered the ride
                    if (top.type === "LIVE_RIDE_OFFER") {
                        console.log("[BrowserNotifications] Live ride offer detected, liveRide:", top.liveRide);
                        if (top.liveRide) {
                            console.log("[BrowserNotifications] Setting live ride offer modal");
                            setOfferModal({ notificationId: top.id, offer: top });
                        } else {
                            console.warn("[BrowserNotifications] Live ride offer but no liveRide data");
                        }
                    }
                } else {
                    console.log("[BrowserNotifications] Notification already seen:", top.id);
                }
            } catch (err) {
                console.error("[BrowserNotifications] Error checking notifications:", err);
            }
        };

        // Check immediately
        checkNotifications();

        // Then poll every 5 seconds (reduced from 20 for faster response)
        const id = window.setInterval(checkNotifications, 5000);

        return () => window.clearInterval(id);
    }, [supports, role]); // Removed liveOn dependency - modal should show regardless

    // Debug: log modal state (must be before any early returns)
    useEffect(() => {
        if (offerModal) {
            console.log("[BrowserNotifications] Modal state changed:", offerModal);
        }
    }, [offerModal]);

    if (!supports) return null;
    if (!isCaptainRole(role ?? undefined)) return null;

    async function acceptLiveRide() {
        const lr = offerModal?.offer?.liveRide;
        if (!lr?.id) return;
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        try {
            const res = await fetch(`/api/live-rides/${lr.id}/accept-inline`, { method: "POST" });
            if (!res.ok) {
                const t = await res.text();
                alert(t || "Failed to accept live ride");
                return;
            }
            await fetch(`/api/notifications/${offerModal!.notificationId}/read`, { method: "POST" });
            setOfferModal(null);
            window.location.href = "/captain/trips";
        } finally {
            inFlightRef.current = false;
        }
    }

    async function rejectLiveRide() {
        const lr = offerModal?.offer?.liveRide;
        if (!lr?.id) return;
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        try {
            const res = await fetch(`/api/live-rides/${lr.id}/reject-inline`, { method: "POST" });
            if (!res.ok) {
                const t = await res.text();
                alert(t || "Failed to reject live ride");
                return;
            }
            await fetch(`/api/notifications/${offerModal!.notificationId}/read`, { method: "POST" });
            setOfferModal(null);
        } finally {
            inFlightRef.current = false;
        }
    }

    return (
        <>
            {offerModal?.offer?.type === "LIVE_RIDE_OFFER" && offerModal.offer.liveRide ? (
                <div className={styles.modalBackdrop} role="dialog" aria-label="Live ride offer">
                    <button
                        className={styles.modalBackdropBtn}
                        type="button"
                        aria-hidden="true"
                        tabIndex={-1}
                        onClick={() => {
                            console.log("[BrowserNotifications] Modal backdrop clicked - closing");
                            setOfferModal(null);
                        }}
                    />
                    <div className={styles.modal}>
                        <div className={styles.modalTitle}>Live ride request</div>
                        <div className={styles.modalMeta}>{makeBody(offerModal.offer)}</div>
                        <div className={styles.modalActions}>
                            <button className={styles.primary} type="button" onClick={acceptLiveRide}>
                                Accept
                            </button>
                            <button className={styles.danger} type="button" onClick={rejectLiveRide}>
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {permission !== "granted" && !dismissed ? (
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
            ) : null}
        </>
    );
}

