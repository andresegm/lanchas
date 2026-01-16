import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getApiBaseUrl } from "@/lib/apiBase";
import styles from "./page.module.css";
import { formatUsdFromCents } from "@/lib/money";

type CaptainTripsResponse = {
    trips: Array<{
        id: string;
        status: string;
        startAt: string;
        endAt: string;
        currency: string;
        totalCents: number;
        boat: { name: string };
        createdBy: { email: string };
        payment: null | { status: string };
    }>;
};

export default async function CaptainTripsPage() {
    const apiBase = getApiBaseUrl() ?? "http://127.0.0.1:3001";

    const cookieStore = await cookies();
    const cookieHeader = cookieStore
        .getAll()
        .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
        .join("; ");

    const res = await fetch(new URL("/trips/captain", apiBase), {
        headers: { cookie: cookieHeader },
        cache: "no-store"
    });

    if (res.status === 401) redirect("/login");
    if (!res.ok) {
        redirect("/captain");
    }

    const data = (await res.json()) as CaptainTripsResponse;

    return (
        <div className={styles.wrap}>
            <h1 className={styles.h1}>Captain trips</h1>
            <p className={styles.p}>Accept/reject requests.</p>

            <div className={styles.list}>
                {data.trips.map((t) => (
                    <div key={t.id} className={styles.card}>
                        <div className={styles.titleRow}>
                            <div className={styles.title}>{t.boat.name}</div>
                            <span className={styles.badge}>{t.status}</span>
                        </div>
                        <div className={styles.meta}>
                            {t.createdBy.email} • {t.startAt} → {t.endAt}
                        </div>
                        <div className={styles.meta}>
                            Total: {formatUsdFromCents(t.totalCents)} {t.currency} • Payment: {t.payment?.status ?? "NONE"}
                        </div>

                        {t.status === "REQUESTED" ? (
                            <div className={styles.row}>
                                <form method="POST" action={`/api/captain/trips/accept?id=${t.id}`}>
                                    <button className={styles.primary} type="submit">
                                        Accept
                                    </button>
                                </form>
                                <form method="POST" action={`/api/captain/trips/reject?id=${t.id}`}>
                                    <button className={styles.secondary} type="submit">
                                        Reject
                                    </button>
                                </form>
                            </div>
                        ) : null}

                        {t.status === "ACCEPTED" ? (
                            <form method="POST" action={`/api/captain/trips/${t.id}/complete`}>
                                <button className={styles.secondary} type="submit">
                                    Mark completed
                                </button>
                            </form>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
}

