export function dollarsToCents(input: unknown): number | null {
    if (input === null || input === undefined) return null;
    const n = typeof input === "number" ? input : Number(input);
    if (!Number.isFinite(n)) return null;
    // allow 0.01 minimum
    const cents = Math.round(n * 100);
    return cents;
}

