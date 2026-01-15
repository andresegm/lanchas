import { NextResponse } from "next/server";

export async function proxyJson(req: Request, targetPath: string) {
    const apiBase =
        process.env.NEXT_PUBLIC_API_BASE_URL ??
        (process.env.NODE_ENV !== "production" ? "http://localhost:3001" : undefined);
    if (!apiBase) {
        return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }, { status: 500 });
    }

    const url = new URL(targetPath, apiBase);
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

    const res = await fetch(url, {
        method: req.method,
        headers: {
            "content-type": req.headers.get("content-type") ?? "application/json",
            cookie: req.headers.get("cookie") ?? ""
        },
        body
    });

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
    opts?: { successRedirectTo?: string }
) {
    const apiBase =
        process.env.NEXT_PUBLIC_API_BASE_URL ??
        (process.env.NODE_ENV !== "production" ? "http://localhost:3001" : undefined);
    if (!apiBase) {
        return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }, { status: 500 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    let redirectTo = opts?.successRedirectTo ?? "/dashboard";
    let payload: Record<string, unknown> = {};

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
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            cookie: req.headers.get("cookie") ?? ""
        },
        body: JSON.stringify(payload)
    });

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
