import { cookies } from "next/headers";
import styles from "./nav.module.css";
import { getApiBaseUrl } from "@/lib/apiBase";

type MeResponse = { user: { email: string; role: string } };
type NotificationsMeResponse = { unreadCount: number };

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
    const isCaptain = me?.user?.role === "CAPTAIN" || me?.user?.role === "BOTH";

    let unread = 0;
    if (authed && isCaptain) {
        const apiBase = getApiBaseUrl();
        if (apiBase) {
            const cookieStore = await cookies();
            const cookieHeader = cookieStore
                .getAll()
                .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
                .join("; ");
            try {
                const res = await fetch(new URL("/notifications/me?unreadOnly=1&limit=1", apiBase), {
                    headers: { cookie: cookieHeader },
                    cache: "no-store"
                });
                if (res.ok) {
                    const data = (await res.json()) as NotificationsMeResponse;
                    unread = data.unreadCount ?? 0;
                }
            } catch {
                // ignore
            }
        }
    }

    const desktopLinks = authed ? (
        <>
            <a href="/" className={styles.link}>
                Home
            </a>
            <a href="/boats" className={styles.link}>
                Boats
            </a>
            <a href="/destinations" className={styles.link}>
                Destinations
            </a>
            <a href="/trips" className={styles.link}>
                My trips
            </a>
            <a href="/live-rides" className={styles.link}>
                Live ride
            </a>
            {isCaptain ? (
                <a href="/captain/log" className={styles.link}>
                    Captain Log {unread > 0 ? <span className={styles.badge}>{unread}</span> : null}
                </a>
            ) : null}
            <a href="/profile" className={styles.meta}>
                {me?.user.email}
            </a>
            <form method="POST" action="/api/auth/logout">
                <button className={styles.button} type="submit">
                    Logout
                </button>
            </form>
        </>
    ) : (
        <>
            <a href="/" className={styles.link}>
                Home
            </a>
            <a href="/boats" className={styles.link}>
                Boats
            </a>
            <a href="/destinations" className={styles.link}>
                Destinations
            </a>
            <a href="/login" className={styles.link}>
                Login
            </a>
            <a href="/register" className={styles.link}>
                Register
            </a>
            <a href="/live-rides" className={styles.link}>
                Live ride
            </a>
        </>
    );

    const mobileMenuItems = authed ? (
        <>
            <a href="/" className={styles.menuLink}>
                Home
            </a>
            <a href="/boats" className={styles.menuLink}>
                Boats
            </a>
            <a href="/destinations" className={styles.menuLink}>
                Destinations
            </a>
            <a href="/trips" className={styles.menuLink}>
                My trips
            </a>
            <a href="/live-rides" className={styles.menuLink}>
                Live ride
            </a>
            {isCaptain ? (
                <a href="/captain/log" className={styles.menuLink}>
                    Captain Log {unread > 0 ? <span className={styles.badge}>{unread}</span> : null}
                </a>
            ) : null}
            <a href="/profile" className={styles.menuMeta}>
                {me?.user.email}
            </a>
            <form method="POST" action="/api/auth/logout" className={styles.menuForm}>
                <button className={styles.menuButton} type="submit">
                    Logout
                </button>
            </form>
        </>
    ) : (
        <>
            <a href="/" className={styles.menuLink}>
                Home
            </a>
            <a href="/boats" className={styles.menuLink}>
                Boats
            </a>
            <a href="/destinations" className={styles.menuLink}>
                Destinations
            </a>
            <a href="/login" className={styles.menuLink}>
                Login
            </a>
            <a href="/register" className={styles.menuLink}>
                Register
            </a>
            <a href="/live-rides" className={styles.menuLink}>
                Live ride
            </a>
        </>
    );

    return (
        <div className={styles.wrap}>
            <div className={styles.desktop}>{desktopLinks}</div>

            <details className={styles.mobile}>
                <summary className={styles.burger} aria-label="Open menu">
                    Menu
                </summary>
                <div className={styles.menu}>{mobileMenuItems}</div>
            </details>
        </div>
    );
}

