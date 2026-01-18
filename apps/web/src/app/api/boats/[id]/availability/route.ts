import { proxyJson } from "@/lib/proxy";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const qs = url.search ? url.search : "";
    return proxyJson(req, `/boats/${id}/availability${qs}`);
}

