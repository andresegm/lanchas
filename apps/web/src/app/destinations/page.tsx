import styles from "./page.module.css";

type Destination = {
    slug: string;
    name: string;
    rumbo: "RUMBO_1" | "RUMBO_2" | "RUMBO_3";
    subtitle: string;
    description: string;
};

const DESTS: Destination[] = [
    {
        slug: "las-borrachas",
        name: "Las Borrachas",
        rumbo: "RUMBO_1",
        subtitle: "Small rocky islets (snorkeling + scenic stop)",
        description:
            "Small rocky islets known for snorkeling and scenic stops rather than traditional beach lounging. The formations are part of the park’s rugged marine landscape. Water around these rocks is clear and ideal for quick swims or underwater viewing, but there’s minimal sandy beach. Most tours include this as an early or midday stop en route to larger beaches."
    },
    {
        slug: "puinare",
        name: "Puinare",
        rumbo: "RUMBO_1",
        subtitle: "Busiest beach stop in Mochima",
        description:
            "Puinare — on Isla Chimana Grande — is one of the most visited beaches in the park, especially in high season, with regular traffic from tour boats and daily passengers from Puerto La Cruz and Guanta. It features wide sandy areas, crystal-clear water, and basic services (toldos, chairs, restaurants) that make it popular for full-day stays. Visitors enjoy snorkel, kayak, or swim at calm waters, and the landscape includes tropical vegetation and varied shoreline terrain."
    },
    {
        slug: "el-faro",
        name: "El Faro",
        rumbo: "RUMBO_1",
        subtitle: "Classic beach + party spot at night",
        description:
            "Playa El Faro on Isla Chimana Segunda is known for its white sand and calm water — similar to other Mochima beaches — and beach services like rentals and food options. At night, it turns into a festive anchorage zone: yachts and lanchas anchor in the bay after dark, lights come on, and music/dancing/impromptu parties often continue long into the evening."
    },
    {
        slug: "el-saco",
        name: "El Saco",
        rumbo: "RUMBO_1",
        subtitle: "Sheltered bay with tranquil water",
        description:
            "El Saco is a sheltered bay beach on Isla Chimana Grande with tranquil waters and sandy patches. It’s frequently included in day-trip circuits, offering space for swimming and relaxation. Compared to Puinare, it’s slightly more low-key but still busy during peak times because it’s near other main stops."
    },
    {
        slug: "bahia-del-silencio",
        name: "Bahía del Silencio",
        rumbo: "RUMBO_1",
        subtitle: "Quiet bay with glass-like water",
        description:
            "As the name implies, this bay tends to be calmer and quieter — a great respite between more crowded stops. It’s characterized by glass-like water and peaceful vibes, making it ideal for swimming, floating, or resting on the boat. It’s less developed than Puinare and tends to attract those looking for a more relaxed experience."
    },
    {
        slug: "isla-de-plata",
        name: "Isla de Plata",
        rumbo: "RUMBO_2",
        subtitle: "Turquoise water + white sand",
        description:
            "A classic Mochima beach island with turquoise water and white sand. Travelers rave about its beauty and photographic appeal, and the beach is a popular midday stop. It’s a bigger, open location where swimmers and sunbathers can spread out."
    },
    {
        slug: "varadero",
        name: "Varadero",
        rumbo: "RUMBO_2",
        subtitle: "Long, broad beach (great for groups)",
        description:
            "One of the park’s long and broad beaches with soft sand. Its size gives it space for many visitors, and it’s often highly frequented on weekends and holidays. The water is usually calm enough for easy swimming, and the long shoreline is great for beach games or group activities."
    },
    {
        slug: "punta-la-cruz",
        name: "Punta la Cruz",
        rumbo: "RUMBO_2",
        subtitle: "Quick access from Puerto La Cruz",
        description:
            "A more accessible beach area near the mainland, just off Puerto La Cruz. It’s popular because boats from the city can reach it quickly and conditions are generally relaxed and swimmable. Its convenience means it draws local groups and day trippers who want a beach experience with city access nearby."
    },
    {
        slug: "las-caracas",
        name: "Las Caracas",
        rumbo: "RUMBO_3",
        subtitle: "Postcard-worthy long beach",
        description:
            "A long, beautiful beach area with soft sand and clear water, making it one of the more photographed and postcard-worthy spots in the park. Its broad shore allows for comfortable group areas and extensive swimming opportunities."
    },
    {
        slug: "playa-piscina",
        name: "Playa Piscina",
        rumbo: "RUMBO_3",
        subtitle: "Natural pool (super calm water)",
        description:
            "Named because the water is extremely calm and shallow — like a natural pool — this beach is ideal for casual swimming, floating, or relaxing far from crowds. Many visitors comment on the glasslike quality of the water here."
    },
    {
        slug: "el-tigrillo",
        name: "El Tigrillo",
        rumbo: "RUMBO_3",
        subtitle: "Smaller, quieter scenic spot",
        description:
            "A smaller, scenic beach spot that’s less crowded than neighboring popular sites, offering a peaceful encounter with nature. The water here remains clear and tranquil, usually good for a quiet swim or a secluded picnic beach experience."
    }
];

const RUMBO_TITLE: Record<Destination["rumbo"], string> = {
    RUMBO_1: "🧭 RUMBO 1 — Las Borrachas • Puinare • El Faro • El Saco • Bahía del Silencio",
    RUMBO_2: "🧭 RUMBO 2 — Isla de Plata • Varadero • Punta la Cruz",
    RUMBO_3: "🧭 RUMBO 3 — Las Caracas • Playa Piscina • El Tigrillo"
};

function placeholderStyle(seed: string) {
    // Deterministic gradient per destination (placeholder image).
    const n = Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0);
    const h1 = n % 360;
    const h2 = (h1 + 42) % 360;
    return {
        backgroundImage: `linear-gradient(135deg, hsla(${h1}, 85%, 70%, 0.45), hsla(${h2}, 85%, 65%, 0.35))`
    } as const;
}

export default function DestinationsPage() {
    const groups: Array<Destination["rumbo"]> = ["RUMBO_1", "RUMBO_2", "RUMBO_3"];

    return (
        <div className={styles.wrap}>
            <h1 className={styles.h1}>Destinations</h1>
            <p className={styles.p}>
                Quick guide to the main beaches and stops around Lechería / Mochima. Photos are placeholders for now.
            </p>

            {groups.map((rumbo) => {
                const items = DESTS.filter((d) => d.rumbo === rumbo);
                return (
                    <section key={rumbo} className={styles.section}>
                        <h2 className={styles.h2}>{RUMBO_TITLE[rumbo]}</h2>
                        <div className={styles.grid}>
                            {items.map((d) => (
                                <article key={d.slug} className={styles.card}>
                                    <div className={styles.img} style={placeholderStyle(d.slug)} aria-hidden="true">
                                        <div className={styles.imgLabel}>{d.name}</div>
                                    </div>
                                    <div className={styles.body}>
                                        <div className={styles.title}>{d.name}</div>
                                        <div className={styles.subtitle}>{d.subtitle}</div>
                                        <div className={styles.desc}>{d.description}</div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}

