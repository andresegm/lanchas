import styles from "./page.module.css";
import { LiveRideRequestForm } from "./_components/LiveRideRequestForm";

export default async function LiveRidesPage({ searchParams }: { searchParams?: Promise<{ sent?: string; error?: string }> }) {
    const sp = (await searchParams) ?? {};
    const sent = sp.sent === "1";
    const error = typeof sp.error === "string" ? sp.error : null;

    return (
        <div className={styles.wrap}>
            <h1 className={styles.h1}>Request a live ride</h1>
            <p className={styles.p}>On-the-spot rides from Plaza Mayor. A captain will accept or reject.</p>

            <div className={styles.grid}>
                <div className={styles.card}>
                    {sent ? <div className={styles.ok}>Request sent. Keep an eye on notifications.</div> : null}
                    {error ? (
                        <div className={styles.ok} style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(254,226,226,0.75)" }}>
                            {error}
                        </div>
                    ) : null}

                    <LiveRideRequestForm />
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
                        <div className={styles.rumboText}>Las Caracas (postcard beach), Playa Piscina (calm "pool" water), El Tigrillo (quieter spot).</div>
                    </div>

                    <a className={styles.secondaryLink} href="/destinations">
                        See full destination guide →
                    </a>
                </div>
            </div>
        </div>
    );
}

