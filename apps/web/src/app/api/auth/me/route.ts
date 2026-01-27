import { proxyAuthForm, proxyJson } from "@/lib/proxy";

export async function GET(req: Request) {
    return proxyJson(req, "/auth/me");
}

export async function POST(req: Request) {
    return proxyAuthForm(req, "/auth/me", { successRedirectTo: "/profile", method: "PUT" });
}
