import styles from "./page.module.css";
import { getApiBaseUrl } from "@/lib/apiBase";
import { formatUsdFromCents } from "@/lib/money";

type BoatsResponse = {
    boats: Array<{
        id: string;
        name: string;
        captain: { displayName: string };
        photos?: Array<{ id: string; url: string }>;
        rumboPricings: Array<{
            rumbo: "RUMBO_1" | "RUMBO_2" | "RUMBO_3";
            currency: string;
            hourlyRateCents: number;
        }>;
    }>;
};

async function fetchFeaturedBoats(): Promise<BoatsResponse["boats"]> {
    const apiBase = getApiBaseUrl();
    if (!apiBase) return [];
    try {
        const res = await fetch(new URL("/boats", apiBase), { cache: "no-store" });
        if (!res.ok) return [];
        const data = (await res.json()) as BoatsResponse;
        return data.boats.slice(0, 8);
    } catch {
        return [];
    }
}

export default async function HomePage() {
    const boats = await fetchFeaturedBoats();

    return (
        <div className={styles.wrap}>
            <section className={styles.mast}>
                <div className={styles.mastInner}>
                    <div className={styles.kicker}>Lechería • Day trips to nearby islands</div>
                    <h1 className={styles.h1}>Book a boat day trip like booking a stay.</h1>
                    <p className={styles.sub}>
                        Browse real boats from independent captains, request a time slot, and track the booking end‑to‑end.
                    </p>

                    <form className={styles.search} action="/boats" method="GET">
                        <label className={`${styles.seg} ${styles.segTight}`}>
                            <div className={styles.segLabel}>Destino</div>
                            <select className={styles.input} name="destino" defaultValue="">
                                <option value="">Any</option>
                                <option value="Las Borrachas">Las Borrachas</option>
                                <option value="Puinare">Puinare</option>
                                <option value="El Faro">El Faro</option>
                                <option value="El Saco">El Saco</option>
                                <option value="Bahia del Silencio">Bahia del Silencio</option>
                                <option value="Isla de Plata">Isla de Plata</option>
                                <option value="Varadero">Varadero</option>
                                <option value="Punta la Cruz">Punta la Cruz</option>
                                <option value="Las Caracas">Las Caracas</option>
                                <option value="Playa Piscina">Playa Piscina</option>
                                <option value="El Tigrillo">El Tigrillo</option>
                            </select>
                        </label>
                        <div className={styles.divider} />
                        <label className={`${styles.seg} ${styles.segTight}`}>
                            <div className={styles.segLabel}>Passengers</div>
                            <input className={styles.input} name="pax" type="number" min={1} placeholder="6" />
                        </label>
                        <div className={styles.divider} />
                        <label className={styles.seg}>
                            <div className={styles.segLabel}>Date</div>
                            <input className={styles.input} name="date" type="date" />
                        </label>
                        <div className={styles.divider} />
                        <label className={styles.seg}>
                            <div className={styles.segLabel}>Start</div>
                            <input className={styles.input} name="startTime" type="time" />
                        </label>
                        <div className={styles.divider} />
                        <label className={styles.seg}>
                            <div className={styles.segLabel}>Hours</div>
                            <input className={styles.input} name="hours" type="number" min={1} step={1} placeholder="4" />
                        </label>
                        <div className={styles.divider} />
                        <label className={styles.seg}>
                            <div className={styles.segLabel}>Max $/hr</div>
                            <input className={styles.input} name="maxPrice" type="number" min={1} step={1} placeholder="120" />
                        </label>
                        <button className={styles.searchBtn} type="submit">
                            Search
                        </button>
                    </form>

                    <div className={styles.chips}>
                        <a className={styles.chip} href="/boats">
                            Popular
                        </a>
                        <a className={styles.chip} href="/boats?destino=Las%20Borrachas">
                            Las Borrachas
                        </a>
                        <a className={styles.chip} href="/boats?destino=Isla%20de%20Plata">
                            Isla de Plata
                        </a>
                        <a className={styles.chip} href="/boats">
                            Family-friendly
                        </a>
                        <a className={styles.chip} href="/boats">
                            Sunset
                        </a>
                        <a className={styles.chip} href="/captain/log">
                            List your boat
                        </a>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHead}>
                    <h2 className={styles.h2}>How it works</h2>
                </div>

                <div className={styles.howGrid}>
                    <div className={styles.howCard}>
                        <div className={styles.howTop}>
                            <div className={styles.howNum}>1</div>
                            <div className={styles.howTitle}>Browse boats</div>
                        </div>
                        <div className={styles.howBody}>Pick an island (destino), check photos, capacity, and hourly rates.</div>
                    </div>
                    <div className={styles.howCard}>
                        <div className={styles.howTop}>
                            <div className={styles.howNum}>2</div>
                            <div className={styles.howTitle}>Request a time</div>
                        </div>
                        <div className={styles.howBody}>Choose your route and select an available start/end time on the calendar.</div>
                    </div>
                    <div className={styles.howCard}>
                        <div className={styles.howTop}>
                            <div className={styles.howNum}>3</div>
                            <div className={styles.howTitle}>Captain confirms</div>
                        </div>
                        <div className={styles.howBody}>The captain accepts or rejects your request. You can track status in My Trips.</div>
                    </div>
                    <div className={styles.howCard}>
                        <div className={styles.howTop}>
                            <div className={styles.howNum}>4</div>
                            <div className={styles.howTitle}>Pay & go</div>
                        </div>
                        <div className={styles.howBody}>Once accepted, complete payment (stub in V1), then enjoy your day on the water.</div>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHead}>
                    <h2 className={styles.h2}>Featured boats</h2>
                    <a className={styles.more} href="/boats">
                        See all
                    </a>
                </div>

                <div className={styles.grid}>
                    {(boats.length ? boats : new Array(6).fill(null)).map((b, idx) =>
                        b ? (
                            <a key={b.id} className={styles.card} href={`/boats/${b.id}`}>
                                {b.photos?.[0]?.url ? (
                                    <img className={styles.thumbImg} src={b.photos[0].url} alt={`${b.name} photo`} />
                                ) : (
                                    <div className={styles.thumb} aria-hidden="true" />
                                )}
                                <div className={styles.cardBody}>
                                    <div className={styles.cardTitle}>{b.name}</div>
                                    <div className={styles.cardMeta}>{b.captain.displayName}</div>
                                    <div className={styles.cardMeta}>
                                        {(() => {
                                            if (!b.rumboPricings?.length) return "Hourly rate not set";
                                            const min = Math.min(...b.rumboPricings.map((x: BoatsResponse["boats"][number]["rumboPricings"][number]) => x.hourlyRateCents));
                                            const cur = b.rumboPricings[0]?.currency ?? "USD";
                                            return `From ${formatUsdFromCents(min)} ${cur}/hr`;
                                        })()}
                                    </div>
                                </div>
                            </a>
                        ) : (
                            <div key={`sk_${idx}`} className={styles.card} aria-hidden="true">
                                <div className={styles.thumb} />
                                <div className={styles.cardBody}>
                                    <div className={styles.skelLine} />
                                    <div className={styles.skelLineSm} />
                                </div>
                            </div>
                        )
                    )}
                </div>

                <div className={styles.disclaimer}>
                    <strong>Important:</strong> Lanchas is a marketplace. Captains are independent operators responsible for
                    licensing, insurance, safety, and vessel condition.
                </div>
            </section>
        </div>
    );
}

