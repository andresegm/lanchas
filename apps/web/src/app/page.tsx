import styles from "./page.module.css";

export default function HomePage() {
    return (
        <div className={styles.wrap}>
            <h1 className={styles.h1}>Day Boat Marketplace — Lechería</h1>
            <p className={styles.p}>
                A thin, trusted layer between people with boats and people who want to use them.
            </p>
            <div className={styles.ctaRow}>
                <a className={styles.primary} href="/register">
                    Create account
                </a>
                <a className={styles.secondary} href="/login">
                    Login
                </a>
                <a className={styles.secondary} href="/dashboard">
                    Dashboard
                </a>
            </div>
        </div>
    );
}

