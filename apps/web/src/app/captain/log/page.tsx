import { cookies } from "next/headers";
import styles from "./page.module.css";
import { getApiBaseUrl } from "@/lib/apiBase";
import { formatCaracasRange } from "@/lib/datetime";
import { NotificationsClient } from "./NotificationsClient";

type CaptainMeResponse = {
    captain: null | {
        id: string;
        boats: Array<{
            id: string;
            name: string;
            liveRidesOn: boolean;
        }>;
    };
};

type NotificationsMeResponse = {
    unreadCount: number;
    notifications: Array<{
        id: string;
        type: string;
        createdAt: string;
        readAt: string | null;
        trip: null | {
            id: string;
            startAt: string;
            endAt: string;
            passengerCount: number;
            rumbo: string | null;
            boat: { id: string; name: string };
            createdBy: { id: string; email: string };
        };
        liveRide?: null | {
            id: string;
            pickupPoint: string;
            rumbo: string;
            passengerCount: number;
            hours: number;
            currency: string;
            totalCents: number;
            createdBy: { id: string; email: string };
        };
    }>;
};

async function loadNotifications(): Promise<NotificationsMeResponse | null> {
    const apiBase = getApiBaseUrl();
    if (!apiBase) return null;

    const cookieStore = await cookies();
    const cookieHeader = cookieStore
        .getAll()
        .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
        .join("; ");

    try {
        const res = await fetch(new URL("/notifications/me?limit=15", apiBase), {
            headers: { cookie: cookieHeader },
            cache: "no-store"
        });
        if (!res.ok) return null;
        return (await res.json()) as NotificationsMeResponse;
    } catch {
        return null;
    }
}

async function loadCaptainMe(): Promise<CaptainMeResponse | null> {
    const apiBase = getApiBaseUrl();
    if (!apiBase) return null;

    const cookieStore = await cookies();
    const cookieHeader = cookieStore
        .getAll()
        .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
        .join("; ");

    try {
        const res = await fetch(new URL("/captain/me", apiBase), {
            headers: { cookie: cookieHeader },
            cache: "no-store"
        });
        if (!res.ok) return null;
        return (await res.json()) as CaptainMeResponse;
    } catch {
        return null;
    }
}

function rumboLabel(r: string | null) {
    if (r === "RUMBO_1") return "Rumbo 1";
    if (r === "RUMBO_2") return "Rumbo 2";
    if (r === "RUMBO_3") return "Rumbo 3";
    return r ?? "—";
}

export default async function CaptainLogPage() {
    const notifs = await loadNotifications();
    const cap = await loadCaptainMe();
    const boats = cap?.captain?.boats ?? [];
    const topUnreadId = notifs?.notifications?.find((n) => !n.readAt)?.id ?? null;
    return (
        <div className={styles.wrap}>
            <h1 className={styles.h1}>Captain Log</h1>
            <p className={styles.p}>Everything you need as a captain, in one place.</p>

            <div className={styles.grid}>
                <a className={styles.card} href="/captain">
                    <div className={styles.title}>Boats & Pricing</div>
                    <div className={styles.meta}>Create boats, add photos, and set hourly rates.</div>
                </a>
                <a className={styles.card} href="/captain/trips">
                    <div className={styles.title}>Trip requests</div>
                    <div className={styles.meta}>Accept/reject requests, mark trips completed.</div>
                </a>
            </div>

            {cap?.captain && boats.length > 0 ? (
                <div className={styles.cardWide}>
                    <div className={styles.rowHead}>
                        <div>
                            <div className={styles.title}>Live rides</div>
                            <div className={styles.meta}>Enable live rides for specific boats to receive on-the-spot ride offers.</div>
                        </div>
                    </div>
                    <div className={styles.boatList}>
                        {boats.map((boat) => (
                            <div key={boat.id} className={styles.boatRow}>
                                <div>
                                    <div className={styles.boatName}>{boat.name}</div>
                                    <div className={styles.meta}>
                                        {boat.liveRidesOn ? "On — receiving live ride offers" : "Off — not receiving live ride offers"}
                                    </div>
                                </div>
                                <form method="POST" action="/api/captain/me/live-rides">
                                    <input type="hidden" name="boatId" value={boat.id} />
                                    <input type="hidden" name="enabled" value={boat.liveRidesOn ? "false" : "true"} />
                                    <input type="hidden" name="redirectTo" value="/captain/log" />
                                    <button className={`${styles.toggle} ${boat.liveRidesOn ? styles.toggleOn : ""}`} type="submit" aria-label={`Toggle live rides for ${boat.name}`}>
                                        <span className={styles.knob} />
                                    </button>
                                </form>
                            </div>
                        ))}
                    </div>
                </div>
            ) : cap?.captain ? (
                <div className={styles.cardWide}>
                    <div className={styles.meta}>Create a boat first to enable live rides.</div>
                </div>
            ) : null}

            <div className={styles.cardWide}>
                <div className={styles.rowHead}>
                    <div>
                        <div className={styles.title}>Notifications</div>
                        <div className={styles.meta}>
                            {notifs ? `${notifs.unreadCount} unread` : "Sign in as a captain to see notifications."}
                        </div>
                    </div>
                    {notifs && notifs.unreadCount > 0 ? (
                        <form method="POST" action="/api/notifications/read-all">
                            <button className={styles.secondary} type="submit">
                                Mark all read
                            </button>
                        </form>
                    ) : null}
                </div>

                {notifs ? <NotificationsClient initialUnread={notifs.unreadCount} initialTopUnreadId={topUnreadId} /> : null}

                {notifs?.notifications?.length ? (
                    <div className={styles.list}>
                        {notifs.notifications.map((n) => (
                            <div key={n.id} className={styles.item}>
                                <div className={styles.itemMain}>
                                    <div className={styles.itemTitle}>
                                        {n.type === "TRIP_REQUESTED"
                                            ? "New trip request"
                                            : n.type === "LIVE_RIDE_OFFER"
                                                ? "Live ride request"
                                                : n.type}
                                        {n.readAt ? null : <span className={styles.dot} aria-label="Unread" />}
                                    </div>
                                    {n.liveRide ? (
                                        <div className={styles.itemMeta}>
                                            {n.liveRide.pickupPoint} • {rumboLabel(n.liveRide.rumbo)} • {n.liveRide.passengerCount} pax •{" "}
                                            {n.liveRide.hours}h • {n.liveRide.createdBy.email}
                                        </div>
                                    ) : n.trip ? (
                                        <div className={styles.itemMeta}>
                                            {n.trip.boat.name} • {rumboLabel(n.trip.rumbo)} • {n.trip.passengerCount} pax •{" "}
                                            {formatCaracasRange(n.trip.startAt, n.trip.endAt)} • {n.trip.createdBy.email}
                                        </div>
                                    ) : (
                                        <div className={styles.itemMeta}>—</div>
                                    )}
                                </div>
                                {!n.readAt ? (
                                    <form method="POST" action={`/api/notifications/${n.id}/read`}>
                                        <button className={styles.secondary} type="submit">
                                            Mark read
                                        </button>
                                    </form>
                                ) : null}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={styles.meta}>No notifications yet.</div>
                )}
            </div>
        </div>
    );
}

