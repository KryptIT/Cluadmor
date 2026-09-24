import { decryptConfig } from "@/lib/config-crypto";
import { sql } from "@/lib/db";
import { digest, noStoreJson, normalizeHwid, opaque } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function deliveryGuard(token: string, matchType: string, matchValue: string) {
  const routeCheck =
    matchType === "PLACE"
      ? `if tostring(game.PlaceId) ~= "${matchValue}" then error("[Claudmor] invalid place", 0) end\n`
      : matchType === "UNIVERSE"
        ? `if tostring(game.GameId) ~= "${matchValue}" then error("[Claudmor] invalid universe", 0) end\n`
        : "";

  return `local __cm = (getgenv and getgenv()) or _G
if type(__cm.SCRIPT_KEY) ~= "string" or __cm.SCRIPT_KEY == "" then error("[Claudmor] SCRIPT_KEY missing", 0) end
if __cm.__CLAUDMOR_AUTHORIZED ~= true then error("[Claudmor] unauthorized execution", 0) end
if __cm.__CLAUDMOR_DELIVERY ~= "${token}" then error("[Claudmor] invalid delivery token", 0) end
${routeCheck}`;
}

export async function POST(req: Request) {
  let body: {
    ticket?: string;
    hwid?: string;
    placeId?: string | number;
    universeId?: string | number;
  };

  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  if (!body.ticket || !body.hwid) {
    return noStoreJson({ ok: false, error: "missing_fields" }, 400);
  }

  const ticketHash = digest(body.ticket);
  const hwidHash = digest(normalizeHwid(body.hwid));
  const placeId = String(body.placeId || "").trim();
  const universeId = String(body.universeId || "").trim();

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

  const ticket = consumed[0] as any;

  const rows = await sql`
    SELECT r.match_type, r.match_value,
           ss.id AS script_id, ss.name AS script_name,
           ss.source_ciphertext, ss.published_ciphertext
    FROM script_routes r
    JOIN service_scripts ss ON ss.id = r.script_id
    WHERE r.service_id = ${ticket.service_id}
      AND r.enabled = true
      AND (
        (r.match_type = 'PLACE' AND r.match_value = ${placeId})
        OR
        (r.match_type = 'UNIVERSE' AND r.match_value = ${universeId})
        OR
        (r.match_type = 'DEFAULT')
      )
    ORDER BY
      CASE
        WHEN r.match_type = 'PLACE' AND r.match_value = ${placeId} THEN 0
        WHEN r.match_type = 'UNIVERSE' AND r.match_value = ${universeId} THEN 1
        ELSE 2
      END,
      r.priority DESC,
      r.created_at ASC
    LIMIT 1
  `;

  if (!rows[0]) {
    return noStoreJson({ ok: false, error: "no_script_route" }, 404);
  }

  const row = rows[0] as any;
  const encrypted = row.published_ciphertext || row.source_ciphertext;
  const decoded = decryptConfig(encrypted) as { source?: string };
  const payload = String(decoded.source || "");

  if (!payload) {
    return noStoreJson({ ok: false, error: "empty_script" }, 500);
  }

  const deliveryToken = opaque("CMD", 18);
  const source = deliveryGuard(
    deliveryToken,
    String(row.match_type),
    String(row.match_value || "")
  ) + payload;

  await sql`
    INSERT INTO audit_events(service_id, key_id, kind, ip_hash)
    VALUES (${ticket.service_id}, ${ticket.key_id}, 'SCRIPT_DELIVERY', ${hwidHash})
  `;

  return noStoreJson({
    ok: true,
    deliveryToken,
    source,
    scriptName: row.script_name,
    scriptId: row.script_id,
    protected: !!row.published_ciphertext,
    matched: {
      type: row.match_type,
      value: row.match_value
    }
  });
}
