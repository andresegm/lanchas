import { getApiBaseUrl } from "@/lib/apiBase";
import styles from "./page.module.css";
import { formatUsdFromCents } from "@/lib/money";

type BoatsResponse = {
    boats: Array<{
        id: string;
        name: string;
        maxPassengers: number;
        minimumHours: number;
        photos?: Array<{ id: string; url: string }>;
        rating: { avg: number | null; count: number };
        captain: { displayName: string; rating: { avg: number | null; count: number } };
        rumboPricings: Array<{
            rumbo: "RUMBO_1" | "RUMBO_2" | "RUMBO_3";
            currency: string;
            hourlyRateCents: number;
        }>;
    }>;
};

function formatRating(avg: number | null, count: number) {
    if (!avg || count === 0) return "New";
    return `${avg.toFixed(1)}★ (${count})`;
}

function rumboLabel(r: "RUMBO_1" | "RUMBO_2" | "RUMBO_3") {
    if (r === "RUMBO_1") return "Rumbo 1";
    if (r === "RUMBO_2") return "Rumbo 2";
    return "Rumbo 3";
}

const DESTINOS = [
    "Las Borrachas",
    "Puinare",
    "El Faro",
    "El Saco",
    "Bahia del Silencio",
    "Isla de Plata",
    "Varadero",
    "Punta la Cruz",
    "Las Caracas",
    "Playa Piscina",
    "El Tigrillo"
] as const;

export default async function BoatsPage({
    searchParams
}: {
    searchParams?: Promise<{ destino?: string; pax?: string; maxPrice?: string; date?: string; startTime?: string; hours?: string }>;
}) {
    const apiBase = getApiBaseUrl() ?? "http://127.0.0.1:3001";
    const sp = (await searchParams) ?? {};
    const destino = typeof sp.destino === "string" ? sp.destino : "";
    const pax = typeof sp.pax === "string" ? sp.pax : "";
    const maxPrice = typeof sp.maxPrice === "string" ? sp.maxPrice : "";
    const date = typeof sp.date === "string" ? sp.date : "";
    const startTime = typeof sp.startTime === "string" ? sp.startTime : "";
    const hours = typeof sp.hours === "string" ? sp.hours : "";
    const qs = new URLSearchParams();
    if (destino) qs.set("destino", destino);
    if (pax) qs.set("pax", pax);
    if (maxPrice) qs.set("maxPrice", maxPrice);

    // If date + startTime + hours provided, convert to ISO window (America/Caracas is UTC-4).
    // We send startAt/endAt to API for filtering out already-booked boats.
    const tzOffset = "-04:00";
    const hoursNum = Number(hours);
    if (date && startTime && Number.isFinite(hoursNum) && hoursNum > 0) {
        const startAt = new Date(`${date}T${startTime}:00${tzOffset}`);
        const endAt = new Date(startAt.getTime() + hoursNum * 60 * 60 * 1000);
        if (!Number.isNaN(startAt.getTime()) && !Number.isNaN(endAt.getTime())) {
            qs.set("startAt", startAt.toISOString());
            qs.set("endAt", endAt.toISOString());
        }
    }

    const res = await fetch(new URL(`/boats${qs.toString() ? `?${qs.toString()}` : ""}`, apiBase), { cache: "no-store" });
    const data = (await res.json()) as BoatsResponse;

    return (
        <div className={styles.wrap}>
            <h1 className={styles.h1}>Boats</h1>
            <p className={styles.p}>Filter by island (destino), passengers, and max price per hour.</p>

            <form className={styles.filters} method="GET" action="/boats">
                <div className={styles.filterGroup}>
                    <label className={styles.labelInline}>
                        <span className={styles.filterLabel}>Destino</span>
                        <select className={styles.select} name="destino" defaultValue={destino}>
                            <option value="">Any</option>
                            {DESTINOS.map((d) => (
                                <option key={d} value={d}>
                                    {d}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.labelInline}>
                        <span className={styles.filterLabel}>Passengers</span>
                        <input className={styles.select} name="pax" type="number" min={1} placeholder="6" defaultValue={pax} />
                    </label>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.labelInline}>
                        <span className={styles.filterLabel}>Date</span>
                        <input className={styles.select} name="date" type="date" defaultValue={date} />
                    </label>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.labelInline}>
                        <span className={styles.filterLabel}>Start time</span>
                        <input className={styles.select} name="startTime" type="time" defaultValue={startTime} />
                    </label>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.labelInline}>
                        <span className={styles.filterLabel}>Hours</span>
                        <input className={styles.select} name="hours" type="number" min={1} step={1} placeholder="4" defaultValue={hours} />
                    </label>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.labelInline}>
                        <span className={styles.filterLabel}>Max $/hr</span>
                        <input className={styles.select} name="maxPrice" type="number" min={1} step={1} placeholder="120" defaultValue={maxPrice} />
                    </label>
                </div>
                <button className={styles.secondary} type="submit">
                    Apply filters
                </button>
            </form>

            <div className={styles.grid}>
                {data.boats.map((b) => (
                    <a key={b.id} href={`/boats/${b.id}`} className={styles.card}>
                        {b.photos?.[0]?.url ? (
                            <img className={styles.thumb} src={b.photos[0].url} alt={`${b.name} photo`} />
                        ) : (
                            <div className={styles.thumbPlaceholder} aria-hidden="true" />
                        )}
                        <div className={styles.title}>{b.name}</div>
                        <div className={styles.meta}>
                            {b.captain.displayName} • {formatRating(b.captain.rating.avg, b.captain.rating.count)} • {b.maxPassengers} pax • min{" "}
                            {b.minimumHours}h
                        </div>
                        <div className={styles.pricing}>
                            {b.rumboPricings.length ? (
                                <ul className={styles.ul}>
                                    <li>
                                        <strong>From</strong>{" "}
                                        {(() => {
                                            const min = Math.min(...b.rumboPricings.map((p) => p.hourlyRateCents));
                                            const cur = b.rumboPricings[0]?.currency ?? "USD";
                                            return `${formatUsdFromCents(min)} ${cur}/hr`;
                                        })()}
                                    </li>
                                    <li>
                                        <strong>Rumbos</strong> {b.rumboPricings.map((p) => rumboLabel(p.rumbo)).join(", ")}
                                    </li>
                                </ul>
                            ) : (
                                <span className={styles.dim}>No rumbos pricing yet</span>
                            )}
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}

