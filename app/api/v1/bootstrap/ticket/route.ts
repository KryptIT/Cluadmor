import { sql } from "@/lib/db";
import { digest, noStoreJson, opaque } from "@/lib/security";
import { bearer, verifySession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = bearer(req.headers);
  const session = token ? verifySession(token) : null;
  if (!session) return noStoreJson({ ok: false, error: "unauthorized" }, 401);

  const ticket = opaque("CLMT", 32);
  const ticketHash = digest(ticket);

  await sql`
    INSERT INTO bootstrap_tickets(service_id, key_id, ticket_hash, hwid_hash, expires_at)
    VALUES (
      ${session.serviceId},
      ${session.keyId},
      ${ticketHash},
      ${session.hwidHash},
      now() + interval '45 seconds'
    )
  `;

  return noStoreJson({ ok: true, ticket, expiresIn: 45 });
}
