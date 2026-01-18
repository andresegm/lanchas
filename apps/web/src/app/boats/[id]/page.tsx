import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getApiBaseUrl } from "@/lib/apiBase";
import styles from "./page.module.css";
import { formatUsdFromCents } from "@/lib/money";

type BoatResponse = {
    boat: {
        id: string;
        name: string;
        maxPassengers: number;
        minimumHours: number;
        captain: { displayName: string };
        photos?: Array<{ id: string; url: string }>;
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

    const privatePricing = b.pricings.find((p) => p.type === "PRIVATE_HOURLY");

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
                    {privatePricing ? (
                        <>
                            <div className={styles.priceLine}>
                                {formatUsdFromCents(privatePricing.privateHourlyRateCents)} {privatePricing.currency}/hr • min{" "}
                                {privatePricing.minimumTripDurationHours}h
                            </div>
                            <form method="POST" action="/api/trips/create" className={styles.form}>
                                <input type="hidden" name="boatId" value={b.id} />
                                <input type="hidden" name="pricingType" value="PRIVATE_HOURLY" />

                                <label className={styles.label}>
                                    <span>Start (ISO)</span>
                                    <input className={styles.input} name="startAt" placeholder="2026-01-20T09:00:00-04:00" required />
                                </label>
                                <label className={styles.label}>
                                    <span>End (ISO)</span>
                                    <input className={styles.input} name="endAt" placeholder="2026-01-20T13:00:00-04:00" required />
                                </label>
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
                        <p className={styles.dim}>No private pricing configured.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

