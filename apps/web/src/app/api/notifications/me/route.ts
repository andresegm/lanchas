import { proxyJson } from "@/lib/proxy";

export async function GET(req: Request) {
    const url = new URL(req.url);
    const qs = url.search ? url.search : "";
    return proxyJson(req, `/notifications/me${qs}`);
}

