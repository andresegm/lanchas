"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";
import { formatUsdFromCents } from "@/lib/money";
import { caracasDayKey, formatCaracasRange, formatCaracasTime, formatCaracasWeekday } from "@/lib/datetime";

type Trip = {
    id: string;
    status: "REQUESTED" | "ACCEPTED" | "ACTIVE" | "COMPLETED" | "CANCELED" | string;
    startAt: string;
    endAt: string;
    rumbo?: "RUMBO_1" | "RUMBO_2" | "RUMBO_3" | string | null;
    passengerCount?: number;
    notes?: string | null;
    currency: string;
    totalCents: number;
    boat: { name: string };
    createdBy: { email: string };
    payment: null | { status: string };
};

function rumboLabel(r: Trip["rumbo"]) {
    if (r === "RUMBO_1") return "Rumbo 1";
    if (r === "RUMBO_2") return "Rumbo 2";
    if (r === "RUMBO_3") return "Rumbo 3";
    if (!r) return "—";
    return String(r);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return aStart < bEnd && aEnd > bStart;
}

function statusColor(t: Trip, isConflictingRequested: boolean) {
    if (t.status === "CANCELED") return styles.pillRed;
    if (t.status === "COMPLETED" && t.payment?.status === "PAID") return styles.pillGreen;
    if (t.status === "REQUESTED") return isConflictingRequested ? styles.pillYellow : styles.pillGrey;
    if (t.status === "ACCEPTED" || t.status === "ACTIVE") return styles.pillBlue;
    if (t.status === "COMPLETED") return styles.pillGreen;
    return styles.pillGrey;
}

function statusLabel(t: Trip) {
    if (t.status === "REQUESTED") return "Pending";
    if (t.status === "ACCEPTED") return "Coming up";
    if (t.status === "ACTIVE") return "Ongoing";
    if (t.status === "COMPLETED") return t.payment?.status === "PAID" ? "Completed • Paid" : "Completed";
    if (t.status === "CANCELED") return "Cancelled";
    return t.status;
}

export function TripsPanel({ trips }: { trips: Trip[] }) {
    const [view, setView] = useState<"list" | "calendar">("list");
    const [weekStart, setWeekStart] = useState<Date>(() => new Date());
    const [openTripId, setOpenTripId] = useState<string | null>(null);

    const byId = useMemo(() => new Map(trips.map((t) => [t.id, t])), [trips]);
    const openTrip = openTripId ? byId.get(openTripId) ?? null : null;

    const conflictingRequestedIds = useMemo(() => {
        const out = new Set<string>();
        const activeLike = trips.filter((t) => t.status !== "CANCELED");
        for (const t of trips) {
            if (t.status !== "REQUESTED") continue;
            const aS = new Date(t.startAt);
            const aE = new Date(t.endAt);
            if (Number.isNaN(aS.getTime()) || Number.isNaN(aE.getTime())) continue;
            for (const other of activeLike) {
                if (other.id === t.id) continue;
                const bS = new Date(other.startAt);
                const bE = new Date(other.endAt);
                if (Number.isNaN(bS.getTime()) || Number.isNaN(bE.getTime())) continue;
                if (overlaps(aS, aE, bS, bE)) {
                    out.add(t.id);
                    break;
                }
            }
        }
        return out;
    }, [trips]);

    const weekKeys = useMemo(() => {
        const keys: string[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
            keys.push(caracasDayKey(d.toISOString()));
        }
        return keys;
    }, [weekStart]);

    const tripsByDayKey = useMemo(() => {
        const m = new Map<string, Trip[]>();
        for (const t of trips) {
            const k = caracasDayKey(t.startAt);
            const arr = m.get(k) ?? [];
            arr.push(t);
            m.set(k, arr);
        }
        for (const [k, arr] of m.entries()) {
            arr.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
            m.set(k, arr);
        }
        return m;
    }, [trips]);

    return (
        <div>
            <div className={styles.toolbar}>
                <div className={styles.toggle}>
                    <button
                        type="button"
                        className={`${styles.toggleBtn} ${view === "list" ? styles.toggleActive : ""}`}
                        onClick={() => setView("list")}
                    >
                        List
                    </button>
                    <button
                        type="button"
                        className={`${styles.toggleBtn} ${view === "calendar" ? styles.toggleActive : ""}`}
                        onClick={() => setView("calendar")}
                    >
                        Calendar
                    </button>
                </div>

                {view === "calendar" ? (
                    <div className={styles.weekNav}>
                        <button type="button" className={styles.secondarySmall} onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 86400000))}>
                            ←
                        </button>
                        <div className={styles.weekLabel}>{formatCaracasWeekday(weekStart.toISOString())}</div>
                        <button type="button" className={styles.secondarySmall} onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 86400000))}>
                            →
                        </button>
                    </div>
                ) : null}
            </div>

            {view === "list" ? (
                <div className={styles.list}>
                    {trips.map((t) => (
                        <div key={t.id} className={styles.card}>
                            <div className={styles.titleRow}>
                                <div className={styles.title}>{t.boat.name}</div>
                                <span className={`${styles.pill} ${statusColor(t, conflictingRequestedIds.has(t.id))}`}>{statusLabel(t)}</span>
                            </div>
                            <div className={styles.meta}>
                                {t.createdBy.email} • {formatCaracasRange(t.startAt, t.endAt)}
                            </div>
                            <div className={styles.meta}>Passengers: {t.passengerCount ?? 1}</div>
                            <div className={styles.meta}>Rumbo: {rumboLabel(t.rumbo)}</div>
                            <div className={styles.meta}>
                                Total: {formatUsdFromCents(t.totalCents)} {t.currency} • Payment: {t.payment?.status ?? "NONE"}
                            </div>

                            {t.status === "REQUESTED" ? (
                                <div className={styles.row}>
                                    <form method="POST" action={`/api/captain/trips/accept?id=${t.id}`}>
                                        <button className={styles.primary} type="submit">
                                            Accept
                                        </button>
                                    </form>
                                    <form method="POST" action={`/api/captain/trips/reject?id=${t.id}`}>
                                        <button className={styles.secondary} type="submit">
                                            Reject
                                        </button>
                                    </form>
                                </div>
                            ) : null}

                            {(t.status === "ACCEPTED" || t.status === "ACTIVE") ? (
                                <form method="POST" action={`/api/captain/trips/${t.id}/complete`}>
                                    <button className={styles.secondary} type="submit">
                                        Mark completed
                                    </button>
                                </form>
                            ) : null}
                        </div>
                    ))}
                </div>
            ) : (
                <div className={styles.calendar}>
                    {weekKeys.map((k) => {
                        const dayTrips = tripsByDayKey.get(k) ?? [];
                        const labelIso = dayTrips[0]?.startAt ?? `${k}T12:00:00.000Z`;
                        return (
                            <div key={k} className={styles.dayCol}>
                                <div className={styles.dayHead}>{formatCaracasWeekday(labelIso)}</div>
                                <div className={styles.dayBody}>
                                    {dayTrips.length ? (
                                        dayTrips.map((t) => (
                                            <div key={t.id} className={styles.eventWrap}>
                                                <button
                                                    type="button"
                                                    className={`${styles.event} ${statusColor(t, conflictingRequestedIds.has(t.id))}`}
                                                    onClick={() => setOpenTripId((cur) => (cur === t.id ? null : t.id))}
                                                >
                                                    <div className={styles.eventTitle}>{t.boat.name}</div>
                                                    <div className={styles.eventMeta}>
                                                        {formatCaracasTime(t.startAt)}–{formatCaracasTime(t.endAt)}
                                                    </div>
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className={styles.empty}>No trips</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {openTrip ? (
                <div className={styles.modalBackdrop} role="dialog" aria-label="Trip actions">
                    <button className={styles.modalBackdropBtn} type="button" onClick={() => setOpenTripId(null)} aria-label="Close" />
                    <div className={styles.modal}>
                        <div className={styles.modalTitle}>{openTrip.boat.name}</div>
                        <div className={styles.modalMeta}>
                            {openTrip.createdBy.email} • {formatCaracasRange(openTrip.startAt, openTrip.endAt)}
                        </div>
                        <div className={styles.modalMeta}>Passengers: {openTrip.passengerCount ?? 1}</div>
                        <div className={styles.modalMeta}>Rumbo: {rumboLabel(openTrip.rumbo)}</div>
                        {openTrip.notes ? <div className={styles.modalNote}>Notes: {openTrip.notes}</div> : null}
                        <div className={styles.modalMeta}>
                            <span className={`${styles.pill} ${statusColor(openTrip, conflictingRequestedIds.has(openTrip.id))}`}>
                                {statusLabel(openTrip)}
                            </span>
                            {"  "}• Total: {formatUsdFromCents(openTrip.totalCents)} {openTrip.currency} • Payment:{" "}
                            {openTrip.payment?.status ?? "NONE"}
                        </div>

                        <div className={styles.modalRow}>
                            {openTrip.status === "REQUESTED" ? (
                                <>
                                    <form method="POST" action={`/api/captain/trips/accept?id=${openTrip.id}`}>
                                        <button className={styles.primary} type="submit">
                                            Accept
                                        </button>
                                    </form>
                                    <form method="POST" action={`/api/captain/trips/reject?id=${openTrip.id}`}>
                                        <button className={styles.secondary} type="submit">
                                            Reject
                                        </button>
                                    </form>
                                </>
                            ) : null}
                            {(openTrip.status === "ACCEPTED" || openTrip.status === "ACTIVE") ? (
                                <form method="POST" action={`/api/captain/trips/${openTrip.id}/complete`}>
                                    <button className={styles.secondary} type="submit">
                                        Mark completed
                                    </button>
                                </form>
                            ) : null}
                            <button className={styles.secondary} type="button" onClick={() => setOpenTripId(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

