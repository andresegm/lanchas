import { proxyAuthForm } from "@/lib/proxy";

export async function POST(req: Request, ctx: { params: Promise<{ boatId: string; photoId: string }> }) {
    const { boatId, photoId } = await ctx.params;
    return proxyAuthForm(req, `/captain/boats/${boatId}/photos/${photoId}/delete`, { successRedirectTo: "/captain" });
}

