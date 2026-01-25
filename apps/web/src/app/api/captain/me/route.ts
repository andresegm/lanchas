import { proxyAuthForm, proxyJson } from "@/lib/proxy";

export async function GET(req: Request) {
    return proxyJson(req, "/captain/me");
}

export async function POST(req: Request) {
    return proxyAuthForm(req, "/captain/me", { successRedirectTo: "/captain?updated=profile" });
}

