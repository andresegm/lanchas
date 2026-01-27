"use client";

import { useState, FormEvent } from "react";
import { LiveRidePreviewModal } from "./LiveRidePreviewModal";
import styles from "../page.module.css";

export function LiveRideRequestForm() {
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState<{
        rumbo: string;
        passengerCount: number;
        hours: number;
        pickupPoint: string;
    } | null>(null);

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);

        const rumbo = formData.get("rumbo") as string;
        const passengerCount = Number(formData.get("passengerCount"));
        const hours = Number(formData.get("hours"));

        if (!rumbo || !passengerCount || !hours) {
            return;
        }

        setPreviewData({
            rumbo,
            passengerCount,
            hours,
            pickupPoint: "Plaza Mayor"
        });
        setShowPreview(true);
    };

    const handleConfirm = () => {
        if (previewData) {
            const form = document.querySelector('form[action="/api/live-rides"]') as HTMLFormElement;
            if (form) {
                form.submit();
            }
        }
    };

    return (
        <>
            <form method="POST" action="/api/live-rides" className={styles.form} onSubmit={handleSubmit}>
                <label className={styles.label}>
                    <span>Pickup point</span>
                    <input className={styles.input} value="Plaza Mayor (fixed for MVP)" readOnly />
                </label>

                <label className={styles.label}>
                    <span>Rumbo (route)</span>
                    <select className={styles.input} name="rumbo" required defaultValue="">
                        <option value="" disabled>
                            Select a rumbo
                        </option>
                        <option value="RUMBO_1">Rumbo 1 — $60/hr</option>
                        <option value="RUMBO_2">Rumbo 2 — $80/hr</option>
                        <option value="RUMBO_3">Rumbo 3 — $100/hr</option>
                    </select>
                </label>

                <div className={styles.row}>
                    <label className={styles.label}>
                        <span>People</span>
                        <input className={styles.input} name="passengerCount" type="number" min={1} defaultValue={1} required />
                    </label>
                    <label className={styles.label}>
                        <span>Hours (min 4)</span>
                        <input className={styles.input} name="hours" type="number" min={4} defaultValue={4} required />
                    </label>
                </div>

                <div className={styles.meta}>
                    Pricing is fixed for MVP and does not depend on the boat. This will be improved later.
                </div>

                <button className={styles.primary} type="submit">
                    Request now
                </button>
            </form>

            {showPreview && previewData ? (
                <LiveRidePreviewModal data={previewData} onConfirm={handleConfirm} onCancel={() => setShowPreview(false)} />
            ) : null}
        </>
    );
}
