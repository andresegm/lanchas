import { proxyAuthForm } from "@/lib/proxy";

export async function POST(req: Request, ctx: { params: Promise<{ boatId: string }> }) {
    const { boatId } = await ctx.params;
    return proxyAuthForm(req, `/captain/boats/${boatId}/rumbos`, { successRedirectTo: "/captain?updated=rumbos" });
}

