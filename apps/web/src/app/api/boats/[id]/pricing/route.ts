import { proxyAuthForm } from "@/lib/proxy";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    return proxyAuthForm(req, `/boats/${id}/pricing`, { successRedirectTo: "/captain" });
}

