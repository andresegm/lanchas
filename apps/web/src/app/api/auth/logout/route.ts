import { proxyJson } from "@/lib/proxy";

export async function POST(req: Request) {
    return proxyJson(req, "/auth/logout");
}

