import { proxyAuthForm } from "@/lib/proxy";

export async function POST(req: Request) {
    return proxyAuthForm(req, "/live-rides", { successRedirectTo: "/live-rides?sent=1" });
}

