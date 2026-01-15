import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getApiBaseUrl } from "@/lib/apiBase";
import styles from "./page.module.css";

type TripsMeResponse = {
    trips: Array<{
        id: string;
        status: "REQUESTED" | "ACCEPTED" | "ACTIVE" | "COMPLETED" | "CANCELED";
        startAt: string;
        endAt: string;
        currency: string;
        totalCents: number;
        boat: { name: string };
        payment: null | { status: string; amountCents: number };
    }>;
};

export default async function TripsPage() {
    const apiBase = getApiBaseUrl() ?? "http://127.0.0.1:3001";

    const cookieStore = await cookies();
    const cookieHeader = cookieStore
        .getAll()
        .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
        .join("; ");

    const res = await fetch(new URL("/trips/me", apiBase), {
        headers: { cookie: cookieHeader },
        cache: "no-store"
    });

    if (res.status === 401) redirect("/login");
    const data = (await res.json()) as TripsMeResponse;

    return (
        <div className={styles.wrap}>
            <h1 className={styles.h1}>My trips</h1>
            <p className={styles.p}>Requests, accepted trips, and stub payments.</p>

            <div className={styles.list}>
                {data.trips.map((t) => (
                    <div key={t.id} className={styles.card}>
                        <div className={styles.titleRow}>
                            <div className={styles.title}>{t.boat.name}</div>
                            <span className={styles.badge}>{t.status}</span>
                        </div>
                        <div className={styles.meta}>
                            {t.startAt} → {t.endAt}
                        </div>
                        <div className={styles.meta}>
                            Total: {t.totalCents} {t.currency} • Payment: {t.payment?.status ?? "NONE"}
                        </div>

                        {t.status === "ACCEPTED" && !t.payment ? (
                            <form method="POST" action={`/api/trips/${t.id}/pay`}>
                                <button className={styles.primary} type="submit">
                                    Pay (stub)
                                </button>
                            </form>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
}

