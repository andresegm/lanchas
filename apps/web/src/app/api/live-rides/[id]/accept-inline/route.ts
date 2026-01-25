import { proxyJson } from "@/lib/proxy";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    return proxyJson(req, `/live-rides/${id}/accept`);
}

