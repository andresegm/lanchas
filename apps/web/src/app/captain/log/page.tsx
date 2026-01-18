import styles from "./page.module.css";

export default function CaptainLogPage() {
    return (
        <div className={styles.wrap}>
            <h1 className={styles.h1}>Captain Log</h1>
            <p className={styles.p}>Everything you need as a captain, in one place.</p>

            <div className={styles.grid}>
                <a className={styles.card} href="/captain">
                    <div className={styles.title}>Boats & Pricing</div>
                    <div className={styles.meta}>Create boats, add photos, and set hourly rates.</div>
                </a>
                <a className={styles.card} href="/captain/trips">
                    <div className={styles.title}>Trip requests</div>
                    <div className={styles.meta}>Accept/reject requests, mark trips completed.</div>
                </a>
            </div>
        </div>
    );
}

