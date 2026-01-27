import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getApiBaseUrl } from "@/lib/apiBase";
import styles from "./page.module.css";
import { TripsPanel } from "./TripsPanel";
import { formatCaracasRange } from "@/lib/datetime";

type CaptainTripsResponse = {
    trips: Array<{
        id: string;
        status: string;
        startAt: string;
        endAt: string;
        currency: string;
        totalCents: number;
        boat: { name: string };
        createdBy: { firstName: string | null; rating: number | null; reviewCount: number };
        payment: null | { status: string };
        hasGuestReview?: boolean;
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
            <p className={styles.p}>Toggle between list and calendar. Pending conflicts are highlighted.</p>

            <TripsPanel trips={data.trips} />
        </div>
    );
}

