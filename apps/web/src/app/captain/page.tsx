import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import styles from "./page.module.css";
import { getApiBaseUrl } from "@/lib/apiBase";
import { formatUsdFromCents } from "@/lib/money";

type CaptainMe = {
    captain: null | {
        id: string;
        displayName: string;
        bio: string | null;
        phone: string | null;
        boats: Array<{
            id: string;
            name: string;
            maxPassengers: number;
            minimumHours: number;
            pricings: Array<{
                id: string;
                type: "PRIVATE_HOURLY" | "PER_PERSON";
                currency: string;
                privateHourlyRateCents: number | null;
                perPersonRateCents: number | null;
                minimumTripDurationHours: number;
            }>;
        }>;
    };
};

async function fetchCaptainMe(): Promise<CaptainMe> {
    const apiBase = getApiBaseUrl();
    if (!apiBase) redirect("/login");

    const cookieStore = await cookies();
    const cookieHeader = cookieStore
        .getAll()
        .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
        .join("; ");

    const res = await fetch(new URL("/captain/me", apiBase), {
        headers: { cookie: cookieHeader },
        cache: "no-store"
    });

    if (res.status === 401) redirect("/login");
    if (!res.ok) {
        const t = await res.text();
        throw new Error(`Failed to load captain: ${t}`);
    }

    return (await res.json()) as CaptainMe;
}

export default async function CaptainPage({
    searchParams
}: {
    searchParams?: Promise<{ error?: string }>;
}) {
    const sp = (await searchParams) ?? {};
    const error = typeof sp.error === "string" ? sp.error : undefined;

    const data = await fetchCaptainMe();

    return (
        <div className={styles.wrap}>
            <h1 className={styles.h1}>Captain</h1>
            <p className={styles.p}>Manage your captain profile, boats, and pricing.</p>

            {error ? (
                <div className={styles.error}>
                    <strong>Error:</strong> {error}
                </div>
            ) : null}

            {!data.captain ? (
                <div className={styles.card}>
                    <h2 className={styles.h2}>Create captain profile</h2>
                    <form className={styles.form} method="POST" action="/api/captain/create">
                        <label className={styles.label}>
                            <span>Display name</span>
                            <input className={styles.input} name="displayName" required />
                        </label>
                        <label className={styles.label}>
                            <span>Bio (optional)</span>
                            <textarea className={styles.textarea} name="bio" rows={3} />
                        </label>
                        <label className={styles.label}>
                            <span>Phone (optional)</span>
                            <input className={styles.input} name="phone" />
                        </label>
                        <button className={styles.primary} type="submit">
                            Create profile
                        </button>
                    </form>
                </div>
            ) : (
                <>
                    <div className={styles.card}>
                        <h2 className={styles.h2}>Profile</h2>
                        <div className={styles.kv}>
                            <div>
                                <div className={styles.k}>Display name</div>
                                <div className={styles.v}>{data.captain.displayName}</div>
                            </div>
                            <div>
                                <div className={styles.k}>Phone</div>
                                <div className={styles.v}>{data.captain.phone ?? "—"}</div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <h2 className={styles.h2}>Add a boat</h2>
                        <form className={styles.form} method="POST" action="/api/captain/boats/create">
                            <label className={styles.label}>
                                <span>Name</span>
                                <input className={styles.input} name="name" required />
                            </label>
                            <div className={styles.row}>
                                <label className={styles.label}>
                                    <span>Max passengers</span>
                                    <input className={styles.input} name="maxPassengers" type="number" min={1} required />
                                </label>
                                <label className={styles.label}>
                                    <span>Minimum hours</span>
                                    <input className={styles.input} name="minimumHours" type="number" min={1} required />
                                </label>
                            </div>
                            <button className={styles.primary} type="submit">
                                Create boat
                            </button>
                        </form>
                    </div>

                    <div className={styles.card}>
                        <h2 className={styles.h2}>Your boats</h2>
                        {data.captain.boats.length === 0 ? (
                            <p className={styles.p}>No boats yet.</p>
                        ) : (
                            <div className={styles.boats}>
                                {data.captain.boats.map((b) => (
                                    <div key={b.id} className={styles.boat}>
                                        <div className={styles.boatHeader}>
                                            <div>
                                                <div className={styles.boatName}>{b.name}</div>
                                                <div className={styles.meta}>
                                                    {b.maxPassengers} pax • min {b.minimumHours}h
                                                </div>
                                            </div>
                                        </div>

                                        <div className={styles.pricingGrid}>
                                            <div>
                                                <h3 className={styles.h3}>Private hourly</h3>
                                                <form method="POST" action={`/api/boats/${b.id}/pricing`} className={styles.form}>
                                                    <input type="hidden" name="type" value="PRIVATE_HOURLY" />
                                                    <label className={styles.label}>
                                                        <span>Rate (USD)</span>
                                                        <input className={styles.input} name="privateHourlyRate" type="number" min={0.01} step={0.01} required />
                                                    </label>
                                                    <label className={styles.label}>
                                                        <span>Min trip duration (hours)</span>
                                                        <input className={styles.input} name="minimumTripDurationHours" type="number" min={1} required />
                                                    </label>
                                                    <button className={styles.secondary} type="submit">
                                                        Set pricing
                                                    </button>
                                                </form>
                                            </div>
                                        </div>

                                        {b.pricings.some((p) => p.type === "PRIVATE_HOURLY") ? (
                                            <div className={styles.current}>
                                                <div className={styles.k}>Active pricing</div>
                                                <ul className={styles.ul}>
                                                    {b.pricings
                                                        .filter((p) => p.type === "PRIVATE_HOURLY")
                                                        .map((p) => (
                                                            <li key={p.id}>
                                                                <strong>{p.type}</strong> —{" "}
                                                                {`${formatUsdFromCents(p.privateHourlyRateCents)} ${p.currency}/hr`} (min{" "}
                                                                {p.minimumTripDurationHours}h)
                                                            </li>
                                                        ))}
                                                </ul>
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

