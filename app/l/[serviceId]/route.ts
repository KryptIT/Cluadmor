import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { buildPublicBootstrap } from "@/lib/public-bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ serviceId: string }> }
) {
  await ensureWorkspaceSchema();

  const { serviceId } = await context.params;

  const rows = await sql`
    SELECT s.id
    FROM services s
    JOIN service_loaders sl ON sl.service_id = s.id
    WHERE s.id = ${serviceId}
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

  const origin = new URL(req.url).origin;
  const bootstrap = buildPublicBootstrap(origin, serviceId);

  return new Response(bootstrap, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
