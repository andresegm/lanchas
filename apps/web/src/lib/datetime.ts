const CARACAS_TZ = "America/Caracas";

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

