export function getApiBaseUrl(): string | undefined {
    // Prefer explicit config, but keep a safe local-dev fallback.
    return (
        process.env.NEXT_PUBLIC_API_BASE_URL ??
        process.env.API_BASE_URL ??
        (process.env.NODE_ENV !== "production" ? "http://127.0.0.1:3001" : undefined)
    );
}

