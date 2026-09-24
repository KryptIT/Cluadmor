import { sql } from "@/lib/db";
import { digest, noStoreJson, normalizeHwid } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { ticket?: string; hwid?: string };
  try {
    body = await req.json();
  } catch {
    return noStoreJson({ ok: false, error: "invalid_json" }, 400);
  }

  if (!body.ticket || !body.hwid) {
    return noStoreJson({ ok: false, error: "missing_fields" }, 400);
  }

  const ticketHash = digest(body.ticket);
  const hwidHash = digest(normalizeHwid(body.hwid));

  const consumed = await sql`
    UPDATE bootstrap_tickets
    SET consumed_at = now()
    WHERE ticket_hash = ${ticketHash}
      AND hwid_hash = ${hwidHash}
      AND consumed_at IS NULL
      AND expires_at > now()
    RETURNING service_id, key_id
  `;

  if (!consumed[0]) {
    return noStoreJson({ ok: false, error: "invalid_or_consumed_ticket" }, 401);
  }

  // Intentionally returns capabilities, never private Lua/bootstrap source.
  return noStoreJson({
    ok: true,
    protocol: 1,
    capabilities: ["auth", "resolve-script", "obfuscate"],
    endpoints: {
      resolveScript: "/api/v1/loader/resolve",
      obfuscate: "/api/v1/obfuscate"
    }
  });
}
