import { decryptConfig } from "@/lib/config-crypto";
import { sql } from "@/lib/db";
import { noStoreJson } from "@/lib/security";
import { bearer, verifySession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = bearer(req.headers);
  const session = token ? verifySession(token) : null;
  if (!session) return noStoreJson({ ok: false, error: "unauthorized" }, 401);

  let body: { placeId?: string | number; universeId?: string | number };
  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  const placeId = String(body.placeId || "").trim();
  const universeId = String(body.universeId || "").trim();

  const rows = await sql`
    SELECT r.id, r.match_type, r.match_value, ss.id AS script_id,
           ss.name AS script_name, ss.source_ciphertext
    FROM script_routes r
    JOIN service_scripts ss ON ss.id = r.script_id
    WHERE r.service_id = ${session.serviceId}
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
  const decoded = decryptConfig(row.source_ciphertext) as { source?: string };

  return noStoreJson({
    ok: true,
    script: {
      id: row.script_id,
      name: row.script_name,
      source: decoded.source || ""
    },
    matched: {
      type: row.match_type,
      value: row.match_value
    }
  });
}
