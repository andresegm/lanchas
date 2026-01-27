"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import styles from "./page.module.css";

type EarningsData = {
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

type Boat = {
    id: string;
    name: string;
};

export function EarningsClient({ initialData, boats }: { initialData: EarningsData; boats: Boat[] }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [startDate, setStartDate] = useState(searchParams.get("startDate") || "");
    const [endDate, setEndDate] = useState(searchParams.get("endDate") || "");
    const [boatId, setBoatId] = useState(searchParams.get("boatId") || "");
    const [status, setStatus] = useState(searchParams.get("status") || "");

    const applyFilters = () => {
        startTransition(() => {
            const params = new URLSearchParams();
            if (startDate) params.set("startDate", startDate);
            if (endDate) params.set("endDate", endDate);
            if (boatId) params.set("boatId", boatId);
            if (status) params.set("status", status);
            router.push(`/captain/earnings?${params.toString()}`);
        });
    };

    const clearFilters = () => {
        startTransition(() => {
            setStartDate("");
            setEndDate("");
            setBoatId("");
            setStatus("");
            router.push("/captain/earnings");
        });
    };

    return (
        <div className={styles.filtersCard}>
            <h2 className={styles.h2}>Filters</h2>
            <div className={styles.filtersGrid}>
                <div className={styles.filterGroup}>
                    <label className={styles.label}>
                        <span>Start Date</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className={styles.input}
                        />
                    </label>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.label}>
                        <span>End Date</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className={styles.input}
                        />
                    </label>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.label}>
                        <span>Boat</span>
                        <select value={boatId} onChange={(e) => setBoatId(e.target.value)} className={styles.input}>
                            <option value="">All boats</option>
                            {boats.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className={styles.filterGroup}>
                    <label className={styles.label}>
                        <span>Status</span>
                        <select value={status} onChange={(e) => setStatus(e.target.value)} className={styles.input}>
                            <option value="">All statuses</option>
                            <option value="REQUESTED">Requested</option>
                            <option value="ACCEPTED">Accepted</option>
                            <option value="ACTIVE">Active</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CANCELED">Canceled</option>
                        </select>
                    </label>
                </div>
            </div>
            <div className={styles.filterActions}>
                <button onClick={applyFilters} className={styles.primary} disabled={isPending}>
                    Apply Filters
                </button>
                <button onClick={clearFilters} className={styles.secondary} disabled={isPending}>
                    Clear
                </button>
            </div>
        </div>
    );
}
