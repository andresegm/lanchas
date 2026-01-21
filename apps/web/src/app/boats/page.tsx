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
        captain: { displayName: string };
        rumboPricings: Array<{
            rumbo: "RUMBO_1" | "RUMBO_2" | "RUMBO_3";
            currency: string;
            hourlyRateCents: number;
        }>;
    }>;
};

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
    searchParams?: Promise<{ rumbos?: string | string[]; destino?: string }>;
}) {
    const apiBase = getApiBaseUrl() ?? "http://127.0.0.1:3001";
    const sp = (await searchParams) ?? {};
    const rumbos = Array.isArray(sp.rumbos) ? sp.rumbos.join(",") : typeof sp.rumbos === "string" ? sp.rumbos : "";
    const destino = typeof sp.destino === "string" ? sp.destino : "";
    const qs = new URLSearchParams();
    if (rumbos) qs.set("rumbos", rumbos);
    if (destino) qs.set("destino", destino);

    const res = await fetch(new URL(`/boats${qs.toString() ? `?${qs.toString()}` : ""}`, apiBase), { cache: "no-store" });
    const data = (await res.json()) as BoatsResponse;

    return (
        <div className={styles.wrap}>
            <h1 className={styles.h1}>Boats</h1>
            <p className={styles.p}>Filter by rumbo (route) or destination, then request a day trip.</p>

            <form className={styles.filters} method="GET" action="/boats">
                <div className={styles.filterGroup}>
                    <div className={styles.filterLabel}>Rumbos</div>
                    <div className={styles.filterRow}>
                        <label className={styles.check}>
                            <input type="checkbox" name="rumbos" value="RUMBO_1" defaultChecked={rumbos.includes("RUMBO_1")} />
                            <span>Rumbo 1</span>
                        </label>
                        <label className={styles.check}>
                            <input type="checkbox" name="rumbos" value="RUMBO_2" defaultChecked={rumbos.includes("RUMBO_2")} />
                            <span>Rumbo 2</span>
                        </label>
                        <label className={styles.check}>
                            <input type="checkbox" name="rumbos" value="RUMBO_3" defaultChecked={rumbos.includes("RUMBO_3")} />
                            <span>Rumbo 3</span>
                        </label>
                    </div>
                </div>
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
                            {b.captain.displayName} • {b.maxPassengers} pax • min {b.minimumHours}h
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

