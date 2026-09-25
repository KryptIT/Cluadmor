import { sql } from "@/lib/db";
import { noStoreJson } from "@/lib/security";
import { bearer, verifySession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = bearer(req.headers);
  const session = token ? verifySession(token) : null;
  if (!session) return noStoreJson({ ok: false, error: "unauthorized" }, 401);

  let body: { source?: string; preset?: string };
  try {
    body = await req.json();
  } catch {
    return noStoreJson({ ok: false, error: "invalid_json" }, 400);
  }

  if (!body.source || body.source.length > 2_000_000) {
    return noStoreJson({ ok: false, error: "invalid_source" }, 400);
  }

  const reserved = await sql`
    UPDATE users
    SET obfuscation_credits = obfuscation_credits - 1
    WHERE id = ${session.ownerId} AND obfuscation_credits > 0
    RETURNING obfuscation_credits
  `;
  if (!reserved[0]) {
    return noStoreJson({ ok: false, error: "no_obfuscation_credits" }, 402);
  }

  const internalUrl = process.env.CLAUDIUM_INTERNAL_URL;
  const internalSecret = process.env.CLAUDIUM_INTERNAL_SECRET;
  if (!internalUrl || !internalSecret) {
    await sql`UPDATE users SET obfuscation_credits = obfuscation_credits + 1 WHERE id = ${session.ownerId}`;
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
        source: body.source,
        preset: body.preset || "executor",
        antiTamper: false
      }),
      cache: "no-store"
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      await sql`UPDATE users SET obfuscation_credits = obfuscation_credits + 1 WHERE id = ${session.ownerId}`;
      return noStoreJson({ ok: false, error: "obfuscation_failed" }, 502);
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
    await sql`UPDATE users SET obfuscation_credits = obfuscation_credits + 1 WHERE id = ${session.ownerId}`;
    return noStoreJson({ ok: false, error: "obfuscator_unavailable" }, 503);
  }
}
