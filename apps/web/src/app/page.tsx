import styles from "./page.module.css";

export default function HomePage() {
    return (
        <div className={styles.wrap}>
            <section className={styles.hero}>
                <div className={styles.heroLeft}>
                    <div className={styles.kicker}>Lechería • Same-day & scheduled trips</div>
                    <h1 className={styles.h1}>Book a day boat trip in minutes.</h1>
                    <p className={styles.p}>
                        Lanchas is a marketplace that connects independent captains with locals and tourists looking for
                        safe, straightforward day trips to nearby islands. We don’t operate boats—we make booking simple
                        and trusted.
                    </p>

                    <div className={styles.ctaRow}>
                        <a className={styles.primary} href="/boats">
                            Browse boats
                        </a>
                        <a className={styles.secondary} href="/register">
                            Create account
                        </a>
                        <a className={styles.secondary} href="/captain">
                            List your boat
                        </a>
                    </div>

                    <div className={styles.micro}>
                        No WhatsApp chaos • Clear pricing • Payments recorded • Reviews & incident reporting
                    </div>
                </div>

                <div className={styles.heroRight}>
                    <div className={styles.statCard}>
                        <div className={styles.statTitle}>For passengers</div>
                        <ul className={styles.ul}>
                            <li>Find boats fast</li>
                            <li>Request a trip with upfront pricing</li>
                            <li>Track status and pay (stub for now)</li>
                        </ul>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statTitle}>For captains</div>
                        <ul className={styles.ul}>
                            <li>Create your profile</li>
                            <li>Set your hourly rate</li>
                            <li>Accept/complete trips, earn more</li>
                        </ul>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.h2}>How it works</h2>
                <div className={styles.steps}>
                    <div className={styles.step}>
                        <div className={styles.stepNum}>1</div>
                        <div className={styles.stepBody}>
                            <div className={styles.stepTitle}>Browse</div>
                            <div className={styles.stepText}>Explore boats and captains in Lechería.</div>
                        </div>
                    </div>
                    <div className={styles.step}>
                        <div className={styles.stepNum}>2</div>
                        <div className={styles.stepBody}>
                            <div className={styles.stepTitle}>Request</div>
                            <div className={styles.stepText}>Submit a trip request with start/end time.</div>
                        </div>
                    </div>
                    <div className={styles.step}>
                        <div className={styles.stepNum}>3</div>
                        <div className={styles.stepBody}>
                            <div className={styles.stepTitle}>Go</div>
                            <div className={styles.stepText}>Captain accepts, you pay, and the trip happens.</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.disclaimer}>
                    <strong>Important:</strong> Lanchas is a marketplace. Captains are independent operators responsible
                    for licensing, insurance, safety, and vessel condition.
                </div>
            </section>
        </div>
    );
}

