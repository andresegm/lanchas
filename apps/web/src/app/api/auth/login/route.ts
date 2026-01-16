import { proxyAuthForm } from "@/lib/proxy";

export async function POST(req: Request) {
    return proxyAuthForm(req, "/auth/login", { successRedirectTo: "/profile" });
}

