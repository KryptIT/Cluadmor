import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { buildPublicBootstrap } from "@/lib/public-bootstrap";
import { looksLikeBrowserNavigation, protectedHtml } from "@/lib/protected-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function luaResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    }
  });
}

export async function GET(req: Request) {
  await ensureWorkspaceSchema();

  if (looksLikeBrowserNavigation(req)) {
    return new Response(protectedHtml("loader"), {
      status: 403,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "Pragma": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
      }
    });
  }

  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId") || "";
  if (!serviceId) return luaResponse("-- Claudmor service id missing", 400);

  const rows = await sql`
    SELECT s.id
    FROM services s
    JOIN service_loaders sl ON sl.service_id = s.id
    WHERE s.id = ${serviceId}
      AND s.enabled = true
    LIMIT 1
  `;

  if (!rows[0]) return luaResponse("-- Claudmor loader unavailable", 404);

  return luaResponse(buildPublicBootstrap(url.origin, serviceId), 200);
}
