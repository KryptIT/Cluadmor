import { ownerFromRequest } from "@/lib/owner";
import { noStoreJson } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!ownerFromRequest(req)) return noStoreJson({ ok: false, error: "owner_required" }, 401);

  let body: { source?: string; preset?: string };
  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  const source = String(body.source || "");
  if (!source || source.length > 2_000_000) {
    return noStoreJson({ ok: false, error: "invalid_source" }, 400);
  }

  const internalUrl = process.env.CLAUDIUM_INTERNAL_URL;
  const internalSecret = process.env.CLAUDIUM_INTERNAL_SECRET;
  if (!internalUrl || !internalSecret) {
    return noStoreJson({ ok: false, error: "obfuscator_unavailable" }, 503);
  }

  try {
    const upstream = await fetch(internalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${internalSecret}`
      },
      body: JSON.stringify({
        source,
        preset: body.preset || "executor",
        antiTamper: true
      }),
      cache: "no-store"
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      return noStoreJson({ ok: false, error: "obfuscation_failed", detail: text.slice(0, 500) }, 502);
    }

    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "text/plain; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return noStoreJson({ ok: false, error: "obfuscator_unavailable" }, 503);
  }
}
