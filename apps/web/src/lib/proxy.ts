import { NextResponse } from "next/server";
import { getApiBaseUrl } from "./apiBase";

export async function proxyJson(req: Request, targetPath: string) {
    const apiBase = getApiBaseUrl();
    if (!apiBase) {
        return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }, { status: 500 });
    }

    const url = new URL(targetPath, apiBase);
    const bodyText = req.method === "GET" || req.method === "HEAD" ? "" : await req.text();
    // Important: Fastify will try to JSON-parse when content-type is application/json.
    // An empty string body with application/json causes a 400 parse error. Treat empty as "no body".
    const body = bodyText ? bodyText : undefined;
    const hasBody = body !== undefined;

    let res: Response;
    try {
        const headers: Record<string, string> = {
            cookie: req.headers.get("cookie") ?? ""
        };
        // Only set content-type if there's actually a body, or if the original request had one
        if (hasBody || req.headers.get("content-type")) {
            headers["content-type"] = req.headers.get("content-type") ?? "application/json";
        }

        res = await fetch(url, {
            method: req.method,
            headers,
            body
        });
    } catch {
        return NextResponse.json(
            { error: "API unreachable", hint: "Start @lanchas/api on http://127.0.0.1:3001" },
            { status: 502 }
        );
    }

    const out = new NextResponse(res.body, { status: res.status });

    // forward Set-Cookie (Next/undici may expose getSetCookie())
    const anyHeaders = res.headers as any;
    const setCookies: string[] =
        typeof anyHeaders.getSetCookie === "function"
            ? anyHeaders.getSetCookie()
            : res.headers.get("set-cookie")
                ? [res.headers.get("set-cookie") as string]
                : [];

    for (const c of setCookies) out.headers.append("set-cookie", c);
    out.headers.set("content-type", res.headers.get("content-type") ?? "application/json");
    return out;
}

export async function proxyAuthForm(
    req: Request,
    targetPath: string,
    opts?: { successRedirectTo?: string; method?: string }
) {
    const apiBase = getApiBaseUrl();
    if (!apiBase) {
        return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }, { status: 500 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    let redirectTo = opts?.successRedirectTo ?? "/dashboard";
    let payload: Record<string, unknown> = {};
    const method = opts?.method ?? req.method;

    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
        const fd = await req.formData();
        payload = Object.fromEntries(fd.entries());
        const rt = payload["redirectTo"];
        if (typeof rt === "string" && rt) redirectTo = rt;
        delete payload["redirectTo"];
    } else {
        try {
            payload = (await req.json()) as Record<string, unknown>;
        } catch {
            payload = {};
        }
    }

    const url = new URL(targetPath, apiBase);
    let res: Response;
    try {
        res = await fetch(url, {
            method: method === "PUT" ? "PUT" : "POST",
            headers: {
                "content-type": "application/json",
                cookie: req.headers.get("cookie") ?? ""
            },
            body: JSON.stringify(payload)
        });
    } catch {
        const back = req.headers.get("referer") ?? "/login";
        const backUrl = new URL(back, req.url);
        backUrl.searchParams.set("error", "API unreachable (is @lanchas/api running on 127.0.0.1:3001?)");
        return NextResponse.redirect(backUrl, { status: 303 });
    }

    const anyHeaders = res.headers as any;
    const setCookies: string[] =
        typeof anyHeaders.getSetCookie === "function"
            ? anyHeaders.getSetCookie()
            : res.headers.get("set-cookie")
                ? [res.headers.get("set-cookie") as string]
                : [];

    if (res.ok) {
        const out = NextResponse.redirect(new URL(redirectTo, req.url), { status: 303 });
        for (const c of setCookies) out.headers.append("set-cookie", c);
        return out;
    }

    const errText = await res.text();
    const back = req.headers.get("referer") ?? "/login";
    const backUrl = new URL(back, req.url);
    backUrl.searchParams.set("error", errText.slice(0, 200));
    const out = NextResponse.redirect(backUrl, { status: 303 });
    for (const c of setCookies) out.headers.append("set-cookie", c);
    return out;
}
