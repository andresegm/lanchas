import { proxyAuthForm } from "@/lib/proxy";

export async function POST(req: Request) {
    return proxyAuthForm(req, "/notifications/read-all", { successRedirectTo: "/captain/log" });
}

