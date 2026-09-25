import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { HEARTBEAT_INTERVAL_SECONDS, HEARTBEAT_TTL_SECONDS } from "@/lib/runtime-session";
import { clientNonceHash, digest, noStoreJson, normalizeHwid, opaque } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureWorkspaceSchema();

  let body: { token?: string; hwid?: string; nonce?: string };
  try {
    body = await req.json();
  } catch {
    return noStoreJson({ ok: false, error: "invalid_json" }, 400);
  }

  if (!body.token || !body.hwid) {
    return noStoreJson({ ok: false, error: "missing_fields" }, 400);
  }

  const tokenHash = digest(body.token);
  const hwidHash = digest(normalizeHwid(body.hwid));
  const nonceHash = clientNonceHash(body.nonce);

  const nextToken = opaque("CMH", 24);
  const nextHash = digest(nextToken);

  // Rotate the token atomically: the current token is spent and only this beat gets the next one,
  // so a captured heartbeat token is useless once the real client beats again.
  const rotated = await sql`
    UPDATE runtime_sessions
    SET token_hash = ${nextHash},
        last_beat_at = now(),
        beat_count = beat_count + 1,
        expires_at = now() + (${HEARTBEAT_TTL_SECONDS} * interval '1 second')
    WHERE token_hash = ${tokenHash}
      AND hwid_hash = ${hwidHash}
      AND (client_nonce_hash IS NULL OR client_nonce_hash = ${nonceHash})
      AND revoked_at IS NULL
      AND expires_at > now()
    RETURNING id
  `;

  if (!rotated[0]) {
    return noStoreJson({ ok: false, error: "session_ended" }, 401);
  }

  return noStoreJson({
    ok: true,
    token: nextToken,
    interval: HEARTBEAT_INTERVAL_SECONDS
  });
}
