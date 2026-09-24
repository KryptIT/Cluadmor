import { decryptConfig } from "@/lib/config-crypto";
import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ serviceId: string }> }
) {
  await ensureWorkspaceSchema();

  const { serviceId } = await context.params;

  const rows = await sql`
    SELECT sl.loader_ciphertext
    FROM service_loaders sl
    JOIN services s ON s.id = sl.service_id
    WHERE sl.service_id = ${serviceId}
      AND s.enabled = true
    LIMIT 1
  `;

  if (!rows[0]) {
    return new Response("-- Claudmor loader not published", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }

  const decoded = decryptConfig((rows[0] as any).loader_ciphertext) as { source?: string };
  const source = String(decoded.source || "");

  if (!source) {
    return new Response("-- Claudmor loader unavailable", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }

  return new Response(source, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
