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
        rating: { avg: number | null; count: number };
        captain: {
            id: string;
            displayName: string;
            bio: string | null;
            phone: string | null;
            rating: { avg: number | null; count: number };
            reviews?: Array<{
                id: string;
                rating: number;
                comment: string | null;
                authorFirstName: string | null;
                boatName: string;
                createdAt: string;
            }>;
        };
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

function formatRating(avg: number | null, count: number) {
    if (!avg || count === 0) return "New";
    return `${avg.toFixed(1)}★ (${count})`;
}

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
                {b.captain.displayName} • {formatRating(b.captain.rating.avg, b.captain.rating.count)} • {b.maxPassengers} pax • min {b.minimumHours}h
            </div>

            <div className={styles.captainCard}>
                <h2 className={styles.h2}>About {b.captain.displayName}</h2>
                {b.captain.bio ? <p className={styles.bio}>{b.captain.bio}</p> : null}
                {b.captain.phone ? (
                    <div className={styles.meta}>
                        <strong>Phone:</strong> {b.captain.phone}
                    </div>
                ) : null}
                <div className={styles.meta}>
                    <strong>Rating:</strong> {formatRating(b.captain.rating.avg, b.captain.rating.count)}
                </div>

                {b.captain.reviews && b.captain.reviews.length > 0 ? (
                    <div className={styles.reviewsSection}>
                        <h3 className={styles.h3}>Recent reviews</h3>
                        <ul className={styles.reviewsList}>
                            {b.captain.reviews.map((r) => (
                                <li key={r.id} className={styles.reviewItem}>
                                    <div className={styles.reviewHeader}>
                                        <span className={styles.reviewRating}>{r.rating}/5 ★</span>
                                        <span className={styles.reviewAuthor}>{r.authorFirstName ?? "Anonymous"}</span>
                                        <span className={styles.reviewBoat}>{r.boatName}</span>
                                    </div>
                                    {r.comment ? <div className={styles.reviewComment}>{r.comment}</div> : null}
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className={styles.dim}>No reviews yet.</div>
                )}
            </div>

            {b.photos?.length ? (
                <div className={styles.galleryWrap}>
                    <div className={styles.gallery} aria-label="Boat photos">
                        {b.photos.map((p, idx) => (
                            <div key={p.id} className={styles.galleryItem}>
                                <img className={styles.galleryImg} src={p.url} alt={`${b.name} photo ${idx + 1}`} />
                            </div>
                        ))}
                    </div>
                    {b.photos.length > 1 ? <div className={styles.galleryHint}>Swipe/scroll to see more photos →</div> : null}
                </div>
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

                                <label className={styles.label}>
                                    <span>Passengers</span>
                                    <input
                                        className={styles.input}
                                        name="passengerCount"
                                        type="number"
                                        min={1}
                                        max={b.maxPassengers}
                                        defaultValue={1}
                                        required
                                    />
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

                <div className={styles.card}>
                    <h2 className={styles.h2}>Rumbos overview</h2>
                    <p className={styles.dim}>
                        In Lechería, trips typically follow one (or more) of these routes. Your selected rumbo determines the hourly rate.
                    </p>

                    <div className={styles.rumboBlock}>
                        <div className={styles.rumboTitle}>Rumbo 1</div>
                        <div className={styles.rumboText}>
                            Las Borrachas (snorkel stop), Puinare (busiest), El Faro (beach + party at night), El Saco, Bahía del Silencio (quiet bay).
                        </div>
                    </div>
                    <div className={styles.rumboBlock}>
                        <div className={styles.rumboTitle}>Rumbo 2</div>
                        <div className={styles.rumboText}>Isla de Plata (turquoise + white sand), Varadero (long beach), Punta la Cruz (quick access).</div>
                    </div>
                    <div className={styles.rumboBlock}>
                        <div className={styles.rumboTitle}>Rumbo 3</div>
                        <div className={styles.rumboText}>Las Caracas (postcard beach), Playa Piscina (calm “pool” water), El Tigrillo (quieter spot).</div>
                    </div>

                    <a className={styles.secondaryLink} href="/destinations">
                        See full destination guide →
                    </a>
                </div>
            </div>
        </div>
    );
}

