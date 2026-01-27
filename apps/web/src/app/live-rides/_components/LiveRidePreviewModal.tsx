"use client";

import { formatUsdFromCents } from "@/lib/money";
import styles from "./liveRidePreviewModal.module.css";

type LiveRidePreviewData = {
    rumbo: string;
    passengerCount: number;
    hours: number;
    pickupPoint: string;
};

function rumboLabel(r: string) {
    if (r === "RUMBO_1") return "Rumbo 1";
    if (r === "RUMBO_2") return "Rumbo 2";
    if (r === "RUMBO_3") return "Rumbo 3";
    return r;
}

function fixedRateCents(rumbo: string): number {
    if (rumbo === "RUMBO_1") return 60_00;
    if (rumbo === "RUMBO_2") return 80_00;
    return 100_00;
}

function calculateCost(rumbo: string, hours: number) {
    const hourlyRateCents = fixedRateCents(rumbo);
    const subtotalCents = hourlyRateCents * hours;
    const commissionRate = 0.07;
    const commissionCents = Math.round(subtotalCents * commissionRate);
    const totalCents = subtotalCents + commissionCents;
    return { hourlyRateCents, subtotalCents, commissionCents, totalCents };
}

export function LiveRidePreviewModal({
    data,
    onConfirm,
    onCancel
}: {
    data: LiveRidePreviewData | null;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    if (!data) return null;

    const { hourlyRateCents, subtotalCents, commissionCents, totalCents } = calculateCost(data.rumbo, data.hours);

    return (
        <div className={styles.backdrop} role="dialog" aria-label="Live ride preview">
            <button className={styles.backdropBtn} type="button" onClick={onCancel} aria-label="Close" />
            <div className={styles.modal}>
                <h2 className={styles.h2}>Review your live ride request</h2>

                <div className={styles.section}>
                    <div className={styles.row}>
                        <div className={styles.label}>Pickup</div>
                        <div className={styles.value}>{data.pickupPoint}</div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.label}>Route</div>
                        <div className={styles.value}>{rumboLabel(data.rumbo)}</div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.label}>Passengers</div>
                        <div className={styles.value}>{data.passengerCount}</div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.label}>Duration</div>
                        <div className={styles.value}>{data.hours} hour{data.hours !== 1 ? "s" : ""}</div>
                    </div>
                    <div className={styles.meta}>
                        A captain will be notified and can accept or reject your request. If accepted, the trip starts immediately.
                    </div>
                </div>

                <div className={styles.costSection}>
                    <div className={styles.costRow}>
                        <div className={styles.costLabel}>Subtotal ({data.hours}hr × {formatUsdFromCents(hourlyRateCents)}/hr)</div>
                        <div className={styles.costValue}>{formatUsdFromCents(subtotalCents)} USD</div>
                    </div>
                    <div className={styles.costRow}>
                        <div className={styles.costLabel}>Service fee (7%)</div>
                        <div className={styles.costValue}>{formatUsdFromCents(commissionCents)} USD</div>
                    </div>
                    <div className={styles.costTotal}>
                        <div className={styles.costLabel}>Total</div>
                        <div className={styles.costValue}>{formatUsdFromCents(totalCents)} USD</div>
                    </div>
                </div>

                <div className={styles.actions}>
                    <button className={styles.secondary} type="button" onClick={onCancel}>
                        Edit
                    </button>
                    <button className={styles.primary} type="button" onClick={onConfirm}>
                        Confirm & Request
                    </button>
                </div>
            </div>
        </div>
    );
}
