import { proxyAuthForm } from "@/lib/proxy";

export async function POST(req: Request) {
    return proxyAuthForm(req, "/captain/me/live-rides", { successRedirectTo: "/captain" });
}

