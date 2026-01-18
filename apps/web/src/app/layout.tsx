import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "react-datepicker/dist/react-datepicker.css";
import "./globals.css";
import styles from "./layout.module.css";
import { Nav } from "./_components/Nav";

const inter = Inter({
    subsets: ["latin"],
    display: "swap"
});

export const metadata = {
    title: "Lanchas — Day Boat Marketplace",
    description: "A lightweight marketplace for day boat trips in Lechería."
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body className={`${styles.body} ${inter.className}`}>
                <header className={styles.header}>
                    <div className={styles.brand}>Lanchas</div>
                    <nav className={styles.nav}>
                        <Nav />
                    </nav>
                </header>
                <main className={styles.main}>{children}</main>
            </body>
        </html>
    );
}

