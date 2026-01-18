"use client";

import { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import styles from "./availabilityPicker.module.css";

type AvailabilityResponse = {
    boat: { id: string; minimumHours: number };
    blocked: Array<{ startAt: string; endAt: string; status: string }>;
};

function roundToStep(d: Date, stepMinutes: number) {
    const ms = d.getTime();
    const stepMs = stepMinutes * 60 * 1000;
    return new Date(Math.ceil(ms / stepMs) * stepMs);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return aStart < bEnd && aEnd > bStart;
}

export function AvailabilityPicker({ boatId }: { boatId: string }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<AvailabilityResponse | null>(null);
    const [start, setStart] = useState<Date | null>(null);
    const [end, setEnd] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const from = new Date();
                const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
                const res = await fetch(`/api/boats/${boatId}/availability?${qs.toString()}`, { cache: "no-store" });
                if (!res.ok) throw new Error(await res.text());
                const json = (await res.json()) as AvailabilityResponse;
                if (!cancelled) setData(json);
            } catch (e: any) {
                if (!cancelled) setError("Could not load availability.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [boatId]);

    const blocked = useMemo(() => {
        return (data?.blocked ?? []).map((b) => ({
            startAt: new Date(b.startAt),
            endAt: new Date(b.endAt)
        }));
    }, [data]);

    const minHours = data?.boat.minimumHours ?? 1;
    const stepMinutes = 30;

    const timeWindow = useMemo(() => {
        // Simple “daylight hours” window; adjust later if captains define hours.
        const min = new Date();
        min.setHours(6, 0, 0, 0);
        const max = new Date();
        max.setHours(18, 0, 0, 0);
        return { min, max };
    }, []);

    const excludedTimesForDay = useMemo(() => {
        const day = start ?? new Date();
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);

        const slots: Date[] = [];
        const cursor = new Date(dayStart);
        cursor.setHours(6, 0, 0, 0);
        const endCursor = new Date(dayStart);
        endCursor.setHours(18, 0, 0, 0);

        while (cursor <= endCursor) {
            const slotStart = new Date(cursor);
            const slotEnd = new Date(slotStart.getTime() + minHours * 60 * 60 * 1000);
            const blockedHere = blocked.some((b) => overlaps(slotStart, slotEnd, b.startAt, b.endAt));
            if (blockedHere) slots.push(new Date(slotStart));
            cursor.setMinutes(cursor.getMinutes() + stepMinutes);
        }

        // If the day itself is outside the availability window, just exclude everything.
        if (dayEnd < dayStart) return slots;
        return slots;
    }, [blocked, minHours, start]);

    function onStartChange(d: Date | null) {
        if (!d) {
            setStart(null);
            setEnd(null);
            return;
        }
        const s = roundToStep(d, stepMinutes);
        const e = new Date(s.getTime() + minHours * 60 * 60 * 1000);
        setStart(s);
        setEnd(e);
    }

    function onEndChange(d: Date | null) {
        if (!d || !start) return;
        const e = roundToStep(d, stepMinutes);
        setEnd(e);
    }

    const startIso = start ? start.toISOString() : "";
    const endIso = end ? end.toISOString() : "";

    const selectionOverlaps = useMemo(() => {
        if (!start || !end) return false;
        return blocked.some((b) => overlaps(start, end, b.startAt, b.endAt));
    }, [blocked, start, end]);

    const tooShort = useMemo(() => {
        if (!start || !end) return false;
        return end.getTime() - start.getTime() < minHours * 60 * 60 * 1000;
    }, [start, end, minHours]);

    return (
        <div className={styles.wrap}>
            <div className={styles.row}>
                <div className={styles.field}>
                    <div className={styles.label}>Start</div>
                    <DatePicker
                        selected={start}
                        onChange={onStartChange}
                        showTimeSelect
                        timeIntervals={stepMinutes}
                        minDate={new Date()}
                        minTime={timeWindow.min}
                        maxTime={timeWindow.max}
                        excludeTimes={excludedTimesForDay}
                        dateFormat="MMM d, yyyy h:mm aa"
                        placeholderText={loading ? "Loading…" : "Pick a time"}
                        className={styles.input}
                    />
                </div>
                <div className={styles.field}>
                    <div className={styles.label}>End</div>
                    <DatePicker
                        selected={end}
                        onChange={onEndChange}
                        showTimeSelect
                        timeIntervals={stepMinutes}
                        minDate={start ?? new Date()}
                        minTime={timeWindow.min}
                        maxTime={timeWindow.max}
                        dateFormat="MMM d, yyyy h:mm aa"
                        placeholderText="Auto-calculated"
                        className={styles.input}
                        disabled={!start}
                    />
                </div>
            </div>

            <input type="hidden" name="startAt" value={startIso} />
            <input type="hidden" name="endAt" value={endIso} />

            <div className={styles.hint}>
                <div>
                    Minimum duration: <strong>{minHours} hours</strong>
                </div>
                {loading ? <div className={styles.dim}>Loading availability…</div> : null}
                {error ? <div className={styles.error}>{error}</div> : null}
                {selectionOverlaps ? <div className={styles.error}>That time overlaps an existing trip.</div> : null}
                {tooShort ? <div className={styles.error}>Trip must be at least {minHours} hours.</div> : null}
            </div>
        </div>
    );
}

