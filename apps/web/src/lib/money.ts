export function formatUsdFromCents(cents: number | null | undefined): string {
    if (cents === null || cents === undefined) return "—";
    const dollars = cents / 100;
    return `$${dollars.toFixed(2)}`;
}

