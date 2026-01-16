import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import styles from "./page.module.css";
import { getApiBaseUrl } from "@/lib/apiBase";

type MeResponse = { user: { id: string; email: string; role: string; createdAt: string } };

export default async function ProfilePage() {
    const apiBase = getApiBaseUrl();
    if (!apiBase) redirect("/login");

    const cookieStore = await cookies();
    const cookieHeader = cookieStore
        .getAll()
        .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
        .join("; ");

    const res = await fetch(new URL("/auth/me", apiBase), {
        headers: { cookie: cookieHeader },
        cache: "no-store"
    });

    if (res.status === 401) redirect("/login");
    if (!res.ok) redirect("/login");

    const data = (await res.json()) as MeResponse;

    return (
        <div className={styles.card}>
            <h1 className={styles.h1}>Profile</h1>
            <p className={styles.p}>Account details.</p>

            <div className={styles.kv}>
                <div>
                    <div className={styles.k}>Email</div>
                    <div className={styles.v}>{data.user.email}</div>
                </div>
                <div>
                    <div className={styles.k}>Role</div>
                    <div className={styles.v}>{data.user.role}</div>
                </div>
            </div>

            <div className={styles.row}>
                <a className={styles.link} href="/trips">
                    My trips
                </a>
                <a className={styles.link} href="/captain">
                    Captain
                </a>
            </div>

            <form method="POST" action="/api/auth/logout">
                <button className={styles.secondary} type="submit">
                    Logout
                </button>
            </form>
        </div>
    );
}

