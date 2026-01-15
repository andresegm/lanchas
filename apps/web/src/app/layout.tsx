import type { ReactNode } from "react";
import styles from "./layout.module.css";

export const metadata = {
    title: "Lanchas — Day Boat Marketplace",
    description: "A lightweight marketplace for day boat trips in Lechería."
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body className={styles.body}>
                <header className={styles.header}>
                    <div className={styles.brand}>Lanchas</div>
                    <nav className={styles.nav}>
                        <a href="/">Home</a>
                        <a href="/login">Login</a>
                        <a href="/register">Register</a>
                        <a href="/dashboard">Dashboard</a>
                    </nav>
                </header>
                <main className={styles.main}>{children}</main>
            </body>
        </html>
    );
}

