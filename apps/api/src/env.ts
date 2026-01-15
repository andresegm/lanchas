function required(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
}

function optional(name: string, fallback: string): string {
    return process.env[name] ?? fallback;
}

export const env = {
    API_PORT: Number(optional("API_PORT", "3001")),
    API_HOST: optional("API_HOST", "0.0.0.0"),
    API_CORS_ORIGIN: required("API_CORS_ORIGIN"),

    AUTH_JWT_SECRET: required("AUTH_JWT_SECRET"),
    AUTH_ACCESS_TTL_SECONDS: Number(optional("AUTH_ACCESS_TTL_SECONDS", "900")),
    AUTH_REFRESH_TTL_SECONDS: Number(optional("AUTH_REFRESH_TTL_SECONDS", "2592000")),
    AUTH_COOKIE_SECURE: optional("AUTH_COOKIE_SECURE", "false") === "true"
};

