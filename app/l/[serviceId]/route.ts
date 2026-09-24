import { decryptConfig } from "@/lib/config-crypto";
import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: string, status = 200) {
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

function looksLikeBrowserNavigation(req: Request) {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  const accept = (req.headers.get("accept") || "").toLowerCase();
  const mode = (req.headers.get("sec-fetch-mode") || "").toLowerCase();
  const dest = (req.headers.get("sec-fetch-dest") || "").toLowerCase();

  return (
    ua.includes("mozilla/") &&
    (
      mode === "navigate" ||
      dest === "document" ||
      accept.includes("text/html")
    )
  );
}

export async function GET(
  req: Request,
  context: { params: Promise<{ serviceId: string }> }
) {
  await ensureWorkspaceSchema();

  if (looksLikeBrowserNavigation(req)) {
    return response("-- Claudmor loader endpoint", 404);
  }

  const { serviceId } = await context.params;

  const rows = await sql`
    SELECT sl.bootstrap_ciphertext
    FROM service_loaders sl
    JOIN services s ON s.id = sl.service_id
    WHERE s.id = ${serviceId}
      AND s.enabled = true
    LIMIT 1
  `;

  if (!rows[0]) {
    return response("-- Claudmor loader not published", 404);
  }

  const encrypted = (rows[0] as any).bootstrap_ciphertext;

  if (!encrypted) {
    return response("-- Claudmor loader must be re-published", 409);
  }

  const decoded = decryptConfig(encrypted) as { source?: string };
  const source = String(decoded.source || "");

  if (!source) {
    return response("-- Claudmor bootstrap unavailable", 503);
  }

  return response(source, 200);
}
