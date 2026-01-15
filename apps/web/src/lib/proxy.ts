import { NextResponse } from "next/server";

export async function proxyJson(req: Request, targetPath: string) {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
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

