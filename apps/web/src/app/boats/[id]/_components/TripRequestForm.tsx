"use client";

import { useState, FormEvent } from "react";
import { TripPreviewModal } from "./TripPreviewModal";
import { AvailabilityPicker } from "./AvailabilityPicker";
import styles from "../page.module.css";

type BoatData = {
    id: string;
    name: string;
    captain: { displayName: string };
    rumboPricings: Array<{
        id: string;
        rumbo: "RUMBO_1" | "RUMBO_2" | "RUMBO_3";
        currency: string;
        hourlyRateCents: number;
    }>;
    maxPassengers: number;
    minimumHours: number;
};

function rumboLabel(r: "RUMBO_1" | "RUMBO_2" | "RUMBO_3") {
    if (r === "RUMBO_1") return "Rumbo 1";
    if (r === "RUMBO_2") return "Rumbo 2";
    return "Rumbo 3";
}

export function TripRequestForm({ boat }: { boat: BoatData }) {
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState<{
        rumbo: string;
        passengerCount: number;
        startAt: string;
        endAt: string;
        notes?: string;
    } | null>(null);

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);

        const rumbo = formData.get("rumbo") as string;
        const passengerCount = Number(formData.get("passengerCount"));
        const startAt = formData.get("startAt") as string;
        const endAt = formData.get("endAt") as string;
        const notes = (formData.get("notes") as string)?.trim() || undefined;

        if (!rumbo || !startAt || !endAt || !startAt.trim() || !endAt.trim()) {
            // Form validation will handle this
            return;
        }

        const selectedPricing = boat.rumboPricings.find((p) => p.rumbo === rumbo);
        if (!selectedPricing) return;

        setPreviewData({
            rumbo,
            passengerCount,
            startAt,
            endAt,
            notes
        });
        setShowPreview(true);
    };

    const handleConfirm = () => {
        if (previewData) {
            const form = document.querySelector(`form[data-boat-id="${boat.id}"]`) as HTMLFormElement;
            if (form) {
                form.submit();
            }
        }
    };

    const selectedPricing = previewData
        ? boat.rumboPricings.find((p) => p.rumbo === previewData.rumbo)
        : null;

    return (
        <>
            <form
                method="POST"
                action="/api/trips/create"
                className={styles.form}
                onSubmit={handleSubmit}
                data-boat-id={boat.id}
            >
                <input type="hidden" name="boatId" value={boat.id} />
                <input type="hidden" name="pricingType" value="PRIVATE_HOURLY" />

                <label className={styles.label}>
                    <span>Rumbo (route)</span>
                    <select className={styles.input} name="rumbo" required defaultValue="">
                        <option value="" disabled>
                            Select a rumbo
                        </option>
                        {boat.rumboPricings.map((p) => (
                            <option key={p.id} value={p.rumbo}>
                                {rumboLabel(p.rumbo)} — ${(p.hourlyRateCents / 100).toFixed(2)} {p.currency}/hr
                            </option>
                        ))}
                    </select>
                </label>

                <label className={styles.label}>
                    <span>Passengers</span>
                    <input
                        className={styles.input}
                        name="passengerCount"
                        type="number"
                        min={1}
                        max={boat.maxPassengers}
                        defaultValue={1}
                        required
                    />
                </label>

                <AvailabilityPicker boatId={boat.id} />

                <label className={styles.label}>
                    <span>Notes (optional)</span>
                    <textarea className={styles.textarea} name="notes" rows={3} />
                </label>
                <button className={styles.primary} type="submit">
                    Request trip
                </button>
            </form>

            {showPreview && previewData && selectedPricing ? (
                <TripPreviewModal
                    data={{
                        boatName: boat.name,
                        captainName: boat.captain.displayName,
                        rumbo: previewData.rumbo,
                        passengerCount: previewData.passengerCount,
                        startAt: previewData.startAt,
                        endAt: previewData.endAt,
                        hourlyRateCents: selectedPricing.hourlyRateCents,
                        currency: selectedPricing.currency,
                        notes: previewData.notes
                    }}
                    onConfirm={handleConfirm}
                    onCancel={() => setShowPreview(false)}
                />
            ) : null}
        </>
    );
}
