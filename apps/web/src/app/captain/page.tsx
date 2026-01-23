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
            photos: Array<{ id: string; url: string; sortOrder: number }>;
            rumboPricings: Array<{
                id: string;
                rumbo: "RUMBO_1" | "RUMBO_2" | "RUMBO_3";
                currency: string;
                hourlyRateCents: number;
            }>;
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
                        <form className={styles.form} method="POST" action="/api/captain/me">
                            <label className={styles.label}>
                                <span>Display name</span>
                                <input
                                    className={styles.input}
                                    name="displayName"
                                    defaultValue={data.captain.displayName}
                                    required
                                    suppressHydrationWarning
                                />
                            </label>
                            <label className={styles.label}>
                                <span>Bio (optional)</span>
                                <textarea
                                    className={styles.textarea}
                                    name="bio"
                                    rows={3}
                                    defaultValue={data.captain.bio ?? ""}
                                    suppressHydrationWarning
                                />
                            </label>
                            <label className={styles.label}>
                                <span>Phone (optional)</span>
                                <input className={styles.input} name="phone" defaultValue={data.captain.phone ?? ""} suppressHydrationWarning />
                            </label>
                            <button className={styles.secondary} type="submit">
                                Save profile
                            </button>
                        </form>
                    </div>

                    <div className={styles.card}>
                        <h2 className={styles.h2}>Add a boat</h2>
                        <form className={styles.form} method="POST" action="/api/captain/boats/create">
                            <label className={styles.label}>
                                <span>Name</span>
                                <input className={styles.input} name="name" required suppressHydrationWarning />
                            </label>
                            <div className={styles.row}>
                                <label className={styles.label}>
                                    <span>Max passengers</span>
                                    <input className={styles.input} name="maxPassengers" type="number" min={1} required suppressHydrationWarning />
                                </label>
                                <label className={styles.label}>
                                    <span>Minimum hours</span>
                                    <input className={styles.input} name="minimumHours" type="number" min={1} required suppressHydrationWarning />
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

                                        <form className={styles.form} method="POST" action={`/api/captain/boats/${b.id}`}>
                                            <label className={styles.label}>
                                                <span>Boat name</span>
                                                <input className={styles.input} name="name" defaultValue={b.name} required suppressHydrationWarning />
                                            </label>
                                            <button className={styles.secondary} type="submit">
                                                Save boat name
                                            </button>
                                        </form>

                                        <div className={styles.photoRow}>
                                            {b.photos[0]?.url ? (
                                                <img className={styles.photo} src={b.photos[0].url} alt={`${b.name} photo`} />
                                            ) : (
                                                <div className={styles.photoPlaceholder} aria-hidden="true" />
                                            )}
                                            <form className={styles.photoForm} method="POST" action={`/api/captain/boats/${b.id}/photos`}>
                                                <label className={styles.label}>
                                                    <span>Add photo URL</span>
                                                    <input className={styles.input} name="url" placeholder="https://..." required suppressHydrationWarning />
                                                </label>
                                                <button className={styles.secondary} type="submit">
                                                    Add photo
                                                </button>
                                            </form>
                                        </div>

                                        <div className={styles.pricingGrid}>
                                            <div>
                                                <h3 className={styles.h3}>Rumbos pricing (per hour)</h3>
                                                <div className={styles.p}>
                                                    Set the hourly rate for each route your boat supports. Leave blank to remove that rumbo.
                                                </div>

                                                <form method="POST" action={`/api/captain/boats/${b.id}/rumbos/bulk`} className={styles.form}>
                                                    {(() => {
                                                        const rp1 = b.rumboPricings.find((rp) => rp.rumbo === "RUMBO_1");
                                                        const rp2 = b.rumboPricings.find((rp) => rp.rumbo === "RUMBO_2");
                                                        const rp3 = b.rumboPricings.find((rp) => rp.rumbo === "RUMBO_3");
                                                        return (
                                                            <>
                                                                <label className={styles.label}>
                                                                    <span>Rumbo 1 (Las Borrachas, Puinare, El Faro, El Saco, Bahia del Silencio)</span>
                                                                    <input
                                                                        className={styles.input}
                                                                        name="hourlyRateRUMBO_1"
                                                                        type="number"
                                                                        min={0.01}
                                                                        step={0.01}
                                                                        placeholder="USD/hr"
                                                                        defaultValue={rp1 ? (rp1.hourlyRateCents / 100).toFixed(2) : ""}
                                                                        suppressHydrationWarning
                                                                    />
                                                                </label>
                                                                <label className={styles.label}>
                                                                    <span>Rumbo 2 (Isla de Plata, Varadero, Punta la Cruz)</span>
                                                                    <input
                                                                        className={styles.input}
                                                                        name="hourlyRateRUMBO_2"
                                                                        type="number"
                                                                        min={0.01}
                                                                        step={0.01}
                                                                        placeholder="USD/hr"
                                                                        defaultValue={rp2 ? (rp2.hourlyRateCents / 100).toFixed(2) : ""}
                                                                        suppressHydrationWarning
                                                                    />
                                                                </label>
                                                                <label className={styles.label}>
                                                                    <span>Rumbo 3 (Las Caracas, Playa Piscina, El Tigrillo)</span>
                                                                    <input
                                                                        className={styles.input}
                                                                        name="hourlyRateRUMBO_3"
                                                                        type="number"
                                                                        min={0.01}
                                                                        step={0.01}
                                                                        placeholder="USD/hr"
                                                                        defaultValue={rp3 ? (rp3.hourlyRateCents / 100).toFixed(2) : ""}
                                                                        suppressHydrationWarning
                                                                    />
                                                                </label>
                                                                <button className={styles.secondary} type="submit">
                                                                    Save rumbos pricing
                                                                </button>
                                                            </>
                                                        );
                                                    })()}
                                                </form>
                                            </div>
                                        </div>

                                        {b.rumboPricings.length > 0 ? (
                                            <div className={styles.current}>
                                                <div className={styles.k}>Active rumbos</div>
                                                <ul className={styles.ul}>
                                                    {b.rumboPricings.map((p) => (
                                                        <li key={p.id}>
                                                            <strong>{p.rumbo}</strong> — {formatUsdFromCents(p.hourlyRateCents)} {p.currency}/hr
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : (
                                            <div className={styles.dim}>No rumbos configured yet.</div>
                                        )}
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

