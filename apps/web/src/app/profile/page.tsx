import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import styles from "./page.module.css";
import { getApiBaseUrl } from "@/lib/apiBase";

type MeResponse = {
    user: {
        id: string;
        email: string;
        role: string;
        firstName: string | null;
        lastName: string | null;
        dateOfBirth: string | null;
        createdAt: string;
    };
};

export default async function ProfilePage() {
    const apiBase = getApiBaseUrl();
    if (!apiBase) redirect("/login");

    const cookieStore = await cookies();
    const cookieHeader = cookieStore
        .getAll()
        .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
        .join("; ");

    const res = await fetch(new URL("/auth/me", apiBase), {
        headers: { cookie: cookieHeader },
        cache: "no-store"
    });

    if (res.status === 401) redirect("/login");
    if (!res.ok) redirect("/login");

    const data = (await res.json()) as MeResponse;
    const isCaptain = data.user.role === "CAPTAIN" || data.user.role === "BOTH";

    return (
        <div className={styles.card}>
            <h1 className={styles.h1}>Profile</h1>
            <p className={styles.p}>Account details.</p>

            <div className={styles.section}>
                <h2 className={styles.h2}>Personal Information</h2>
                <div className={styles.kv}>
                    <div>
                        <div className={styles.k}>First Name</div>
                        <div className={styles.v}>{data.user.firstName ?? "—"}</div>
                    </div>
                    <div>
                        <div className={styles.k}>Last Name</div>
                        <div className={styles.v}>{data.user.lastName ?? "—"}</div>
                    </div>
                    <div>
                        <div className={styles.k}>Date of Birth</div>
                        <div className={styles.v}>
                            {data.user.dateOfBirth
                                ? (() => {
                                    // Extract date part (YYYY-MM-DD) to avoid timezone issues
                                    const dateStr = data.user.dateOfBirth.split("T")[0];
                                    if (!dateStr) return "—";
                                    const parts = dateStr.split("-");
                                    if (parts.length !== 3) return "—";
                                    const year = parts[0]!;
                                    const month = parts[1]!;
                                    const day = parts[2]!;
                                    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
                                    return date.toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric"
                                    });
                                })()
                                : "—"}
                        </div>
                    </div>
                </div>
                <details className={styles.details}>
                    <summary className={styles.summary}>
                        <span>Edit personal information</span>
                        <span className={styles.summaryHint}>Update name and date of birth</span>
                    </summary>
                    <div className={styles.detailsBody}>
                        <form method="POST" action="/api/auth/me" className={styles.form}>
                            <label className={styles.label}>
                                <span>First Name</span>
                                <input
                                    className={styles.input}
                                    name="firstName"
                                    type="text"
                                    defaultValue={data.user.firstName ?? ""}
                                    autoComplete="given-name"
                                />
                            </label>

                            <label className={styles.label}>
                                <span>Last Name</span>
                                <input
                                    className={styles.input}
                                    name="lastName"
                                    type="text"
                                    defaultValue={data.user.lastName ?? ""}
                                    autoComplete="family-name"
                                />
                            </label>

                            <label className={styles.label}>
                                <span>Date of Birth</span>
                                <input
                                    className={styles.input}
                                    name="dateOfBirth"
                                    type="date"
                                    defaultValue={
                                        data.user.dateOfBirth
                                            ? data.user.dateOfBirth.split("T")[0]
                                            : ""
                                    }
                                    autoComplete="bday"
                                />
                            </label>

                            <button className={styles.secondary} type="submit">
                                Save changes
                            </button>
                        </form>
                    </div>
                </details>
            </div>

            <div className={styles.section}>
                <h2 className={styles.h2}>Account Information</h2>
                <div className={styles.kv}>
                    <div>
                        <div className={styles.k}>Email</div>
                        <div className={styles.v}>{data.user.email}</div>
                    </div>
                    <div>
                        <div className={styles.k}>Role</div>
                        <div className={styles.v}>{data.user.role}</div>
                    </div>
                </div>
            </div>

            <div className={styles.row}>
                <a className={styles.link} href="/trips">
                    My trips
                </a>
                {isCaptain ? (
                    <a className={styles.link} href="/captain/log">
                        Captain&apos;s Log
                    </a>
                ) : (
                    <a className={styles.link} href="/captain">
                        Become a Captain
                    </a>
                )}
            </div>

            <form method="POST" action="/api/auth/logout">
                <button className={styles.secondary} type="submit">
                    Logout
                </button>
            </form>
        </div>
    );
}

