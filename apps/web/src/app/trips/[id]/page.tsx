import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getApiBaseUrl } from "@/lib/apiBase";
import styles from "./page.module.css";
import { formatUsdFromCents } from "@/lib/money";
import { formatCaracasRange } from "@/lib/datetime";

type TripDetail = {
    trip: {
        id: string;
        status: "REQUESTED" | "ACCEPTED" | "ACTIVE" | "COMPLETED" | "CANCELED";
        startAt: string;
        endAt: string;
        notes: string | null;
        currency: string;
        totalCents: number;
        boat: { name: string; captain: { displayName: string; userId: string } };
        participants: Array<{ userId: string; user: { email: string } }>;
        payment: null | { status: string; amountCents: number };
        incidents: Array<{ id: string; type: string; summary: string; createdAt: string }>;
        reviews: Array<{ id: string; targetType: string; rating: number; comment: string | null; createdAt: string; authorId: string }>;
    };
    isCaptain?: boolean;
};

async function loadTrip(id: string): Promise<TripDetail> {
    const apiBase = getApiBaseUrl() ?? "http://127.0.0.1:3001";
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
        .getAll()
        .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
        .join("; ");

    const res = await fetch(new URL(`/trips/${id}`, apiBase), {
        headers: { cookie: cookieHeader },
        cache: "no-store"
    });

    if (res.status === 401) redirect("/login");
    if (!res.ok) redirect("/trips");
    return (await res.json()) as TripDetail;
}

async function loadCurrentUser() {
    const apiBase = getApiBaseUrl() ?? "http://127.0.0.1:3001";
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
        return (await res.json()) as { user: { id: string; email: string; role: string } };
    } catch {
        return null;
    }
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await loadTrip(id);
    const t = data.trip;
    const currentUser = await loadCurrentUser();
    const isCaptain = data.isCaptain || currentUser?.user.role === "CAPTAIN" || currentUser?.user.role === "BOTH";

    return (
        <div className={styles.wrap}>
            <a className={styles.back} href="/trips">
                ← Back to trips
            </a>

            <h1 className={styles.h1}>Trip</h1>
            <div className={styles.meta}>
                {t.boat.name} • {t.boat.captain.displayName} • {formatCaracasRange(t.startAt, t.endAt)}
            </div>
            <div className={styles.meta}>
                Status: <strong>{t.status}</strong> • Total: {formatUsdFromCents(t.totalCents)} {t.currency} • Payment:{" "}
                {t.payment?.status ?? "NONE"}
            </div>
            {(t.status === "ACCEPTED" || t.status === "ACTIVE") && !t.payment ? (
                <form method="POST" action={`/api/trips/${t.id}/pay`}>
                    <button className={styles.secondary} type="submit">
                        Pay (stub)
                    </button>
                </form>
            ) : null}
            {t.notes ? <div className={styles.notes}>Notes: {t.notes}</div> : null}

            <div className={styles.grid}>
                <div className={styles.card}>
                    <h2 className={styles.h2}>Participants</h2>
                    <ul className={styles.ul}>
                        {t.participants.map((p) => (
                            <li key={p.userId}>{p.user.email}</li>
                        ))}
                    </ul>
                </div>

                <div className={styles.card}>
                    <h2 className={styles.h2}>Report an incident</h2>
                    <form method="POST" action={`/api/trips/${t.id}/incidents`} className={styles.form}>
                        <label className={styles.label}>
                            <span>Type</span>
                            <select className={styles.input} name="type" required>
                                <option value="MECHANICAL">MECHANICAL</option>
                                <option value="WEATHER">WEATHER</option>
                                <option value="EMERGENCY">EMERGENCY</option>
                                <option value="OTHER">OTHER</option>
                            </select>
                        </label>
                        <label className={styles.label}>
                            <span>Summary</span>
                            <textarea className={styles.textarea} name="summary" rows={3} required />
                        </label>
                        <button className={styles.secondary} type="submit">
                            Submit incident
                        </button>
                    </form>

                    {t.incidents.length ? (
                        <>
                            <h3 className={styles.h3}>Incidents</h3>
                            <ul className={styles.ul}>
                                {t.incidents.map((i) => (
                                    <li key={i.id}>
                                        <strong>{i.type}</strong>: {i.summary}
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <div className={styles.dim}>No incidents.</div>
                    )}
                </div>
            </div>

            <div className={styles.card}>
                <h2 className={styles.h2}>Reviews</h2>
                <p className={styles.dim}>Reviews can be submitted after the trip is marked COMPLETED.</p>

                <div className={styles.reviewGrid}>
                    {!isCaptain ? (
                        <div>
                            <h3 className={styles.h3}>Review captain</h3>
                            <form method="POST" action={`/api/trips/${t.id}/reviews`} className={styles.form}>
                                <input type="hidden" name="targetType" value="CAPTAIN" />
                                <label className={styles.label}>
                                    <span>Rating</span>
                                    <div className={styles.stars} aria-label="Rating (1-5 stars)">
                                        <input id="cap_star_5" name="rating" type="radio" value="5" required />
                                        <label htmlFor="cap_star_5" title="5 stars">
                                            ★
                                        </label>
                                        <input id="cap_star_4" name="rating" type="radio" value="4" />
                                        <label htmlFor="cap_star_4" title="4 stars">
                                            ★
                                        </label>
                                        <input id="cap_star_3" name="rating" type="radio" value="3" />
                                        <label htmlFor="cap_star_3" title="3 stars">
                                            ★
                                        </label>
                                        <input id="cap_star_2" name="rating" type="radio" value="2" />
                                        <label htmlFor="cap_star_2" title="2 stars">
                                            ★
                                        </label>
                                        <input id="cap_star_1" name="rating" type="radio" value="1" />
                                        <label htmlFor="cap_star_1" title="1 star">
                                            ★
                                        </label>
                                    </div>
                                </label>
                                <label className={styles.label}>
                                    <span>Comment (optional)</span>
                                    <textarea className={styles.textarea} name="comment" rows={3} />
                                </label>
                                <button className={styles.secondary} type="submit">
                                    Submit review
                                </button>
                            </form>
                        </div>
                    ) : null}
                    {isCaptain ? (
                        <div>
                            <h3 className={styles.h3}>Review guests</h3>
                            {(() => {
                                const hasGuestReview = t.reviews.some((r) => r.targetType === "GUEST" && r.authorId === currentUser?.user.id);
                                if (hasGuestReview) {
                                    return <div className={styles.dim}>You have already reviewed the guests on this trip.</div>;
                                }
                                return (
                                    <form method="POST" action={`/api/trips/${t.id}/reviews`} className={styles.form}>
                                        <input type="hidden" name="targetType" value="GUEST" />
                                        <div className={styles.meta}>
                                            Reviewing guests: {t.participants.map((p) => p.user.email).join(", ")}
                                        </div>
                                        <label className={styles.label}>
                                            <span>Rating</span>
                                            <div className={styles.stars} aria-label="Rating (1-5 stars)">
                                                <input id="guest_star_5" name="rating" type="radio" value="5" required />
                                                <label htmlFor="guest_star_5" title="5 stars">
                                                    ★
                                                </label>
                                                <input id="guest_star_4" name="rating" type="radio" value="4" />
                                                <label htmlFor="guest_star_4" title="4 stars">
                                                    ★
                                                </label>
                                                <input id="guest_star_3" name="rating" type="radio" value="3" />
                                                <label htmlFor="guest_star_3" title="3 stars">
                                                    ★
                                                </label>
                                                <input id="guest_star_2" name="rating" type="radio" value="2" />
                                                <label htmlFor="guest_star_2" title="2 stars">
                                                    ★
                                                </label>
                                                <input id="guest_star_1" name="rating" type="radio" value="1" />
                                                <label htmlFor="guest_star_1" title="1 star">
                                                    ★
                                                </label>
                                            </div>
                                        </label>
                                        <label className={styles.label}>
                                            <span>Comment (optional)</span>
                                            <textarea className={styles.textarea} name="comment" rows={3} />
                                        </label>
                                        <button className={styles.secondary} type="submit">
                                            Submit review
                                        </button>
                                    </form>
                                );
                            })()}
                        </div>
                    ) : null}
                </div>

                {t.reviews.length ? (
                    <>
                        <h3 className={styles.h3}>Submitted reviews</h3>
                        <ul className={styles.ul}>
                            {t.reviews.map((r) => (
                                <li key={r.id}>
                                    <strong>{r.targetType}</strong> — {r.rating}/5{r.comment ? `: ${r.comment}` : ""}
                                </li>
                            ))}
                        </ul>
                    </>
                ) : null}
            </div>
        </div>
    );
}

