import { cookies } from "next/headers";
import styles from "./nav.module.css";
import { getApiBaseUrl } from "@/lib/apiBase";

type MeResponse = { user: { email: string; role: string } };

async function getMe() {
    const apiBase = getApiBaseUrl();
    if (!apiBase) return null;

    const cookieStore = await cookies();
    const cookieHeader = cookieStore
        .getAll()
        .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
        .join("; ");

    try {
        const res = await fetch(new URL("/auth/me", apiBase), {
            headers: { cookie: cookieHeader },
            cache: "no-store"
        });
        if (!res.ok) return null;
        return (await res.json()) as MeResponse;
    } catch {
        return null;
    }
}

export async function Nav() {
    const me = await getMe();
    const authed = !!me?.user?.email;

    return (
        <div className={styles.wrap}>
            <a href="/" className={styles.link}>
                Home
            </a>

            {authed ? (
                <>
                    <a href="/dashboard" className={styles.link}>
                        Dashboard
                    </a>
                    <span className={styles.meta}>
                        {me?.user.email} • {me?.user.role}
                    </span>
                    <form method="POST" action="/api/auth/logout">
                        <button className={styles.button} type="submit">
                            Logout
                        </button>
                    </form>
                </>
            ) : (
                <>
                    <a href="/login" className={styles.link}>
                        Login
                    </a>
                    <a href="/register" className={styles.link}>
                        Register
                    </a>
                </>
            )}
        </div>
    );
}

