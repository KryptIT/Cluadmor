import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { digest, noStoreJson, opaque } from "@/lib/security";
import { bearer, verifySession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureWorkspaceSchema();

  const token = bearer(req.headers);
  const session = token ? verifySession(token) : null;
  if (!session) return noStoreJson({ ok: false, error: "unauthorized" }, 401);

  const ticket = opaque("CLMT", 32);
  const ticketHash = digest(ticket);

  const inserted = await sql`
    INSERT INTO bootstrap_tickets(service_id, key_id, ticket_hash, hwid_hash, session_jti, client_nonce_hash, expires_at)
    VALUES (
      ${session.serviceId},
      ${session.keyId},
      ${ticketHash},
      ${session.hwidHash},
      ${digest(session.jti)},
      ${session.clientNonceHash ?? null},
      now() + interval '45 seconds'
    )
    ON CONFLICT (session_jti) DO NOTHING
    RETURNING id
  `;

  // Each session nonce may mint exactly one ticket; a replayed session gets nothing.
  if (!inserted[0]) {
    return noStoreJson({ ok: false, error: "session_already_used" }, 401);
  }

  return noStoreJson({ ok: true, ticket, expiresIn: 45 });
}
