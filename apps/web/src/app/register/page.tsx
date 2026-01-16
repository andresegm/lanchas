import styles from "./page.module.css";

export default async function RegisterPage({
    searchParams
}: {
    searchParams?: Promise<{ error?: string }>;
}) {
    const sp = (await searchParams) ?? {};
    const error = typeof sp.error === "string" ? sp.error : undefined;

    return (
        <div className={styles.card}>
            <h1 className={styles.h1}>Create account</h1>
            <p className={styles.p}>Start as a guest. You can become a captain later.</p>

            {error ? (
                <div className={styles.error}>
                    <strong>Error:</strong> {error}
                </div>
            ) : null}

            <form className={styles.form} method="POST" action="/api/auth/register">
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
                        autoComplete="new-password"
                    />
                </label>

                <input type="hidden" name="redirectTo" value="/profile" />

                <button className={styles.primary} type="submit">
                    Register
                </button>
            </form>

            <p className={styles.footer}>
                Already have an account? <a href="/login">Login</a>
            </p>
        </div>
    );
}

