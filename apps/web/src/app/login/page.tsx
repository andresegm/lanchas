import styles from "./page.module.css";

export default async function LoginPage({
    searchParams
}: {
    searchParams?: Promise<{ error?: string }>;
}) {
    const sp = (await searchParams) ?? {};
    const error = typeof sp.error === "string" ? sp.error : undefined;

    return (
        <div className={styles.card}>
            <h1 className={styles.h1}>Login</h1>
            <p className={styles.p}>Use your email and password.</p>

            {error ? (
                <div className={styles.error}>
                    <strong>Error:</strong> {error}
                </div>
            ) : null}

            <form className={styles.form} method="POST" action="/api/auth/login">
                <label className={styles.label}>
                    <span>Email</span>
                    <input className={styles.input} name="email" type="email" required autoComplete="email" />
                </label>

                <label className={styles.label}>
                    <span>Password</span>
                    <input
                        className={styles.input}
                        name="password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="current-password"
                    />
                </label>

                <input type="hidden" name="redirectTo" value="/profile" />

                <button className={styles.primary} type="submit">
                    Login
                </button>
            </form>

            <p className={styles.footer}>
                No account? <a href="/register">Register</a>
            </p>
        </div>
    );
}

