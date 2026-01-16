import { getApiBaseUrl } from "@/lib/apiBase";
import styles from "./page.module.css";
import { formatUsdFromCents } from "@/lib/money";

type BoatsResponse = {
    boats: Array<{
        id: string;
        name: string;
        maxPassengers: number;
        minimumHours: number;
        captain: { displayName: string };
        pricings: Array<{
            type: "PRIVATE_HOURLY" | "PER_PERSON";
            currency: string;
            privateHourlyRateCents: number | null;
            perPersonRateCents: number | null;
            minimumTripDurationHours: number;
        }>;
    }>;
};

export default async function BoatsPage() {
    const apiBase = getApiBaseUrl() ?? "http://127.0.0.1:3001";
    const res = await fetch(new URL("/boats", apiBase), { cache: "no-store" });
    const data = (await res.json()) as BoatsResponse;

    return (
        <div className={styles.wrap}>
            <h1 className={styles.h1}>Boats</h1>
            <p className={styles.p}>Browse boats and request a day trip.</p>

            <div className={styles.grid}>
                {data.boats.map((b) => (
                    <a key={b.id} href={`/boats/${b.id}`} className={styles.card}>
                        <div className={styles.title}>{b.name}</div>
                        <div className={styles.meta}>
                            {b.captain.displayName} • {b.maxPassengers} pax • min {b.minimumHours}h
                        </div>
                        <div className={styles.pricing}>
                            {b.pricings.length ? (
                                <ul className={styles.ul}>
                                    {b.pricings
                                        .filter((p) => p.type === "PRIVATE_HOURLY")
                                        .map((p) => (
                                            <li key={p.type}>
                                                <strong>{p.type}</strong>{" "}
                                                {p.type === "PRIVATE_HOURLY" ? `${formatUsdFromCents(p.privateHourlyRateCents)} ${p.currency}/hr` : ""}{" "}
                                                (min {p.minimumTripDurationHours}h)
                                            </li>
                                        ))}
                                </ul>
                            ) : (
                                <span className={styles.dim}>No active pricing</span>
                            )}
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}

