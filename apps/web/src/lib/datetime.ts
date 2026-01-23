const CARACAS_TZ = "America/Caracas";

export function caracasDayKey(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    // "2026-01-30" in Caracas time
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: CARACAS_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(d);
}

export function formatCaracasTime(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("en-US", {
        timeZone: CARACAS_TZ,
        hour: "numeric",
        minute: "2-digit"
    }).format(d);
}

export function formatCaracasWeekday(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("en-US", {
        timeZone: CARACAS_TZ,
        weekday: "short",
        month: "short",
        day: "2-digit"
    }).format(d);
}

export function formatCaracasDateTime(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;

    // Example: "Jan 30, 1:00 PM"
    return new Intl.DateTimeFormat("en-US", {
        timeZone: CARACAS_TZ,
        month: "short",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit"
    }).format(d);
}

export function formatCaracasRange(startIso: string, endIso: string) {
    return `${formatCaracasDateTime(startIso)} → ${formatCaracasDateTime(endIso)}`;
}

