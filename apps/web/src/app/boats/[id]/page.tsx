import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getApiBaseUrl } from "@/lib/apiBase";
import styles from "./page.module.css";
import { formatUsdFromCents } from "@/lib/money";
import { AvailabilityPicker } from "./_components/AvailabilityPicker";

type BoatResponse = {
    boat: {
        id: string;
        name: string;
        maxPassengers: number;
        minimumHours: number;
        captain: { displayName: string };
        photos?: Array<{ id: string; url: string }>;
        rumboPricings: Array<{
            id: string;
            rumbo: "RUMBO_1" | "RUMBO_2" | "RUMBO_3";
            currency: string;
            hourlyRateCents: number;
        }>;
        pricings: Array<{
            id: string;
            type: "PRIVATE_HOURLY" | "PER_PERSON";
            currency: string;
            privateHourlyRateCents: number | null;
            perPersonRateCents: number | null;
            minimumTripDurationHours: number;
        }>;
    };
};

function rumboLabel(r: "RUMBO_1" | "RUMBO_2" | "RUMBO_3") {
    if (r === "RUMBO_1") return "Rumbo 1";
    if (r === "RUMBO_2") return "Rumbo 2";
    return "Rumbo 3";
}

async function loadBoat(id: string): Promise<BoatResponse> {
    const apiBase = getApiBaseUrl() ?? "http://127.0.0.1:3001";
    const res = await fetch(new URL(`/boats/${id}`, apiBase), { cache: "no-store" });
    if (!res.ok) throw new Error("Boat not found");
    return (await res.json()) as BoatResponse;
}

export default async function BoatPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await loadBoat(id);
    const b = data.boat;

    return (
        <div className={styles.wrap}>
            <a className={styles.back} href="/boats">
                ← Back to boats
            </a>

            <h1 className={styles.h1}>{b.name}</h1>
            <div className={styles.meta}>
                {b.captain.displayName} • {b.maxPassengers} pax • min {b.minimumHours}h
            </div>

            {b.photos?.[0]?.url ? (
                <img className={styles.heroImg} src={b.photos[0].url} alt={`${b.name} photo`} />
            ) : null}

            <div className={styles.grid}>
                <div className={styles.card}>
                    <h2 className={styles.h2}>Request a trip</h2>
                    {b.rumboPricings.length ? (
                        <>
                            <div className={styles.priceLine}>
                                {(() => {
                                    const min = Math.min(...b.rumboPricings.map((p) => p.hourlyRateCents));
                                    const cur = b.rumboPricings[0]?.currency ?? "USD";
                                    return `From ${formatUsdFromCents(min)} ${cur}/hr • min ${b.minimumHours}h`;
                                })()}
                            </div>
                            <form method="POST" action="/api/trips/create" className={styles.form}>
                                <input type="hidden" name="boatId" value={b.id} />
                                <input type="hidden" name="pricingType" value="PRIVATE_HOURLY" />

                                <label className={styles.label}>
                                    <span>Rumbo (route)</span>
                                    <select className={styles.input} name="rumbo" required defaultValue="">
                                        <option value="" disabled>
                                            Select a rumbo
                                        </option>
                                        {b.rumboPricings.map((p) => (
                                            <option key={p.id} value={p.rumbo}>
                                                {rumboLabel(p.rumbo)} — {formatUsdFromCents(p.hourlyRateCents)} {p.currency}/hr
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <AvailabilityPicker boatId={b.id} />
                                <label className={styles.label}>
                                    <span>Notes (optional)</span>
                                    <textarea className={styles.textarea} name="notes" rows={3} />
                                </label>
                                <button className={styles.primary} type="submit">
                                    Request trip
                                </button>
                            </form>
                        </>
                    ) : (
                        <p className={styles.dim}>This boat has no rumbos pricing configured yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

