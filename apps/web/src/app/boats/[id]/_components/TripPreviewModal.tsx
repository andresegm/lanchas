"use client";

import { formatUsdFromCents } from "@/lib/money";
import { formatCaracasRange } from "@/lib/datetime";
import styles from "./tripPreviewModal.module.css";

type TripPreviewData = {
    boatName: string;
    captainName: string;
    rumbo: string;
    passengerCount: number;
    startAt: string;
    endAt: string;
    hourlyRateCents: number;
    currency: string;
    notes?: string;
};

function rumboLabel(r: string) {
    if (r === "RUMBO_1") return "Rumbo 1";
    if (r === "RUMBO_2") return "Rumbo 2";
    if (r === "RUMBO_3") return "Rumbo 3";
    return r;
}

function calculateCost(hourlyRateCents: number, startAt: string, endAt: string) {
    const start = new Date(startAt);
    const end = new Date(endAt);
    const hours = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60));
    const subtotalCents = hourlyRateCents * hours;
    const commissionRate = 0.07;
    const commissionCents = Math.round(subtotalCents * commissionRate);
    const totalCents = subtotalCents + commissionCents;
    return { hours, subtotalCents, commissionCents, totalCents };
}

export function TripPreviewModal({
    data,
    onConfirm,
    onCancel
}: {
    data: TripPreviewData | null;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    if (!data) return null;

    const { hours, subtotalCents, commissionCents, totalCents } = calculateCost(data.hourlyRateCents, data.startAt, data.endAt);

    return (
        <div className={styles.backdrop} role="dialog" aria-label="Trip preview">
            <button className={styles.backdropBtn} type="button" onClick={onCancel} aria-label="Close" />
            <div className={styles.modal}>
                <h2 className={styles.h2}>Review your trip request</h2>

                <div className={styles.section}>
                    <div className={styles.row}>
                        <div className={styles.label}>Boat</div>
                        <div className={styles.value}>{data.boatName}</div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.label}>Captain</div>
                        <div className={styles.value}>{data.captainName}</div>
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
                        <div className={styles.label}>Date & Time</div>
                        <div className={styles.value}>{formatCaracasRange(data.startAt, data.endAt)}</div>
                    </div>
                    <div className={styles.row}>
                        <div className={styles.label}>Duration</div>
                        <div className={styles.value}>{hours} hour{hours !== 1 ? "s" : ""}</div>
                    </div>
                    {data.notes ? (
                        <div className={styles.row}>
                            <div className={styles.label}>Notes</div>
                            <div className={styles.value}>{data.notes}</div>
                        </div>
                    ) : null}
                </div>

                <div className={styles.costSection}>
                    <div className={styles.costRow}>
                        <div className={styles.costLabel}>Subtotal ({hours}hr × {formatUsdFromCents(data.hourlyRateCents)}/hr)</div>
                        <div className={styles.costValue}>{formatUsdFromCents(subtotalCents)} {data.currency}</div>
                    </div>
                    <div className={styles.costRow}>
                        <div className={styles.costLabel}>Service fee (7%)</div>
                        <div className={styles.costValue}>{formatUsdFromCents(commissionCents)} {data.currency}</div>
                    </div>
                    <div className={styles.costTotal}>
                        <div className={styles.costLabel}>Total</div>
                        <div className={styles.costValue}>{formatUsdFromCents(totalCents)} {data.currency}</div>
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
