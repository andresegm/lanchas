import styles from "./page.module.css";

export default async function LiveRidesPage({ searchParams }: { searchParams?: Promise<{ sent?: string; error?: string }> }) {
    const sp = (await searchParams) ?? {};
    const sent = sp.sent === "1";
    const error = typeof sp.error === "string" ? sp.error : null;

    return (
        <div className={styles.wrap}>
            <h1 className={styles.h1}>Request a live ride</h1>
            <p className={styles.p}>On-the-spot rides from Plaza Mayor. A captain will accept or reject.</p>

            <div className={styles.card}>
                {sent ? <div className={styles.ok}>Request sent. Keep an eye on notifications.</div> : null}
                {error ? (
                    <div className={styles.ok} style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(254,226,226,0.75)" }}>
                        {error}
                    </div>
                ) : null}

                <form method="POST" action="/api/live-rides" className={styles.form}>
                    <label className={styles.label}>
                        <span>Pickup point</span>
                        <input className={styles.input} value="Plaza Mayor (fixed for MVP)" readOnly />
                    </label>

                    <label className={styles.label}>
                        <span>Rumbo (route)</span>
                        <select className={styles.input} name="rumbo" required defaultValue="">
                            <option value="" disabled>
                                Select a rumbo
                            </option>
                            <option value="RUMBO_1">Rumbo 1 — $60/hr</option>
                            <option value="RUMBO_2">Rumbo 2 — $80/hr</option>
                            <option value="RUMBO_3">Rumbo 3 — $100/hr</option>
                        </select>
                    </label>

                    <div className={styles.row}>
                        <label className={styles.label}>
                            <span>People</span>
                            <input className={styles.input} name="passengerCount" type="number" min={1} defaultValue={1} required />
                        </label>
                        <label className={styles.label}>
                            <span>Hours (min 4)</span>
                            <input className={styles.input} name="hours" type="number" min={4} defaultValue={4} required />
                        </label>
                    </div>

                    <div className={styles.meta}>
                        Pricing is fixed for MVP and does not depend on the boat. This will be improved later.
                    </div>

                    <button className={styles.primary} type="submit">
                        Request now
                    </button>
                </form>
            </div>
        </div>
    );
}

