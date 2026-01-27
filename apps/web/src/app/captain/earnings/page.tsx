import { cookies } from "next/headers";
import styles from "./page.module.css";
import { getApiBaseUrl } from "@/lib/apiBase";
import { formatCaracasRange } from "@/lib/datetime";
import { formatUsdFromCents } from "@/lib/money";
import { EarningsClient } from "./EarningsClient";

type EarningsResponse = {
    trips: Array<{
        id: string;
        boatId: string;
        boatName: string;
        status: string;
        startAt: string;
        endAt: string;
        passengerCount: number;
        rumbo: string | null;
        subtotalCents: number;
        totalCents: number;
        currency: string;
        captainEarningsCents: number;
        payment: { id: string; status: string; amountCents: number } | null;
        createdBy: { id: string; firstName: string | null };
        createdAt: string;
    }>;
    summary: {
        totalEarningsCents: number;
        totalSubtotalCents: number;
        totalTotalCents: number;
        tripCount: number;
    };
    breakdown: {
        byStatus: Record<string, { count: number; earningsCents: number; subtotalCents: number }>;
        byBoat: Array<{ boatId: string; boatName: string; count: number; earningsCents: number; subtotalCents: number }>;
    };
    boats: Array<{ id: string; name: string }>;
    pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
    };
};

async function loadEarnings(params: URLSearchParams): Promise<EarningsResponse | null> {
    const apiBase = getApiBaseUrl();
    if (!apiBase) return null;

    const cookieStore = await cookies();
    const cookieHeader = cookieStore
        .getAll()
        .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
        .join("; ");

    const queryString = params.toString();
    const url = queryString ? `/captain/earnings?${queryString}` : "/captain/earnings";

    try {
        const res = await fetch(new URL(url, apiBase), {
            headers: { cookie: cookieHeader },
            cache: "no-store"
        });
        if (!res.ok) return null;
        return (await res.json()) as EarningsResponse;
    } catch {
        return null;
    }
}

function statusLabel(s: string): string {
    if (s === "REQUESTED") return "Requested";
    if (s === "ACCEPTED") return "Accepted";
    if (s === "ACTIVE") return "Active";
    if (s === "COMPLETED") return "Completed";
    if (s === "CANCELED") return "Canceled";
    return s;
}

function rumboLabel(r: string | null): string {
    if (r === "RUMBO_1") return "Rumbo 1";
    if (r === "RUMBO_2") return "Rumbo 2";
    if (r === "RUMBO_3") return "Rumbo 3";
    return r ?? "—";
}

export default async function EarningsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const params = await searchParams;
    const searchParamsObj = new URLSearchParams();
    if (params.startDate && typeof params.startDate === "string") searchParamsObj.set("startDate", params.startDate);
    if (params.endDate && typeof params.endDate === "string") searchParamsObj.set("endDate", params.endDate);
    if (params.boatId && typeof params.boatId === "string") searchParamsObj.set("boatId", params.boatId);
    if (params.status && typeof params.status === "string") searchParamsObj.set("status", params.status);
    if (params.limit && typeof params.limit === "string") searchParamsObj.set("limit", params.limit);
    if (params.offset && typeof params.offset === "string") searchParamsObj.set("offset", params.offset);

    const data = await loadEarnings(searchParamsObj);

    if (!data) {
        return (
            <div className={styles.wrap}>
                <h1 className={styles.h1}>Earnings</h1>
                <p className={styles.error}>Unable to load earnings data.</p>
            </div>
        );
    }

    return (
        <div className={styles.wrap}>
            <h1 className={styles.h1}>Earnings</h1>
            <p className={styles.p}>Track your earnings from completed trips and payments.</p>

            <div className={styles.summaryCard}>
                <div className={styles.summaryRow}>
                    <div className={styles.summaryItem}>
                        <div className={styles.summaryLabel}>Total Earnings</div>
                        <div className={styles.summaryValue}>{formatUsdFromCents(data.summary.totalEarningsCents)}</div>
                        <div className={styles.summaryHint}>80% of subtotal + tips</div>
                    </div>
                    <div className={styles.summaryItem}>
                        <div className={styles.summaryLabel}>Total Trips</div>
                        <div className={styles.summaryValue}>{data.summary.tripCount}</div>
                        <div className={styles.summaryHint}>In selected period</div>
                    </div>
                </div>
            </div>

            <EarningsClient initialData={data} boats={data.boats} />

            {data.breakdown.byBoat.length > 0 && (
                <div className={styles.card}>
                    <h2 className={styles.h2}>Breakdown by Boat</h2>
                    <div className={styles.breakdownGrid}>
                        {data.breakdown.byBoat.map((b) => (
                            <div key={b.boatId} className={styles.breakdownItem}>
                                <div className={styles.breakdownTitle}>{b.boatName}</div>
                                <div className={styles.breakdownMeta}>
                                    {b.count} trip{b.count !== 1 ? "s" : ""} • {formatUsdFromCents(b.earningsCents)} earned
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {Object.keys(data.breakdown.byStatus).length > 0 && (
                <div className={styles.card}>
                    <h2 className={styles.h2}>Breakdown by Status</h2>
                    <div className={styles.breakdownGrid}>
                        {Object.entries(data.breakdown.byStatus).map(([status, stats]) => (
                            <div key={status} className={styles.breakdownItem}>
                                <div className={styles.breakdownTitle}>{statusLabel(status)}</div>
                                <div className={styles.breakdownMeta}>
                                    {stats.count} trip{stats.count !== 1 ? "s" : ""} • {formatUsdFromCents(stats.earningsCents)} earned
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className={styles.card}>
                <h2 className={styles.h2}>Trip Details</h2>
                {data.trips.length > 0 ? (
                    <div className={styles.tripsList}>
                        {data.trips.map((trip) => (
                            <div key={trip.id} className={styles.tripItem}>
                                <div className={styles.tripMain}>
                                    <div className={styles.tripHeader}>
                                        <div className={styles.tripBoat}>{trip.boatName}</div>
                                        <div className={`${styles.tripStatus} ${styles[`status${trip.status}`]}`}>{statusLabel(trip.status)}</div>
                                    </div>
                                    <div className={styles.tripMeta}>
                                        {rumboLabel(trip.rumbo)} • {trip.passengerCount} pax • {formatCaracasRange(trip.startAt, trip.endAt)}
                                    </div>
                                    <div className={styles.tripEarnings}>
                                        Earnings: <strong>{formatUsdFromCents(trip.captainEarningsCents)}</strong> {trip.currency} (80% of {formatUsdFromCents(trip.subtotalCents)}) + tips
                                    </div>
                                    <div className={styles.tripPayment}>
                                        Payment: {trip.payment ? `${trip.payment.status} (${formatUsdFromCents(trip.payment.amountCents)} ${trip.currency})` : "Not paid"}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={styles.empty}>No trips found with the selected filters.</div>
                )}
            </div>
        </div>
    );
}
