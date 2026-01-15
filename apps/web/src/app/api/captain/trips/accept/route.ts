import { proxyAuthForm } from "@/lib/proxy";

export async function POST(req: Request) {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });
    return proxyAuthForm(req, `/trips/${id}/accept`, { successRedirectTo: "/captain/trips" });
}

