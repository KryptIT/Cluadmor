import { decryptConfig } from "@/lib/config-crypto";
import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
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

export async function GET(
  req: Request,
  context: { params: Promise<{ serviceId: string }> }
) {
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

  const { serviceId } = await context.params;

  const rows = await sql`
    SELECT sl.bootstrap_ciphertext
    FROM service_loaders sl
    JOIN services s ON s.id = sl.service_id
    WHERE s.id = ${serviceId}
      AND s.enabled = true
    LIMIT 1
  `;

  if (!rows[0]) return luaResponse("-- Claudmor loader not published", 404);

  const encrypted = (rows[0] as any).bootstrap_ciphertext;
  if (!encrypted) return luaResponse("-- Claudmor loader must be re-published", 409);

  const decoded = decryptConfig(encrypted) as { source?: string };
  const source = String(decoded.source || "");
  if (!source) return luaResponse("-- Claudmor bootstrap unavailable", 503);

  const stageUrl =
    `${new URL(req.url).origin}/api/v1/bootstrap/client?serviceId=${encodeURIComponent(serviceId)}`;

  // Run the obfuscated public gate, but never use its return value as a URL.
  // Some executors do not preserve Claudium VM return values consistently.
  // The real stage URL is generated server-side and compiled with the executor's
  // loadstring that was captured before the VM runs.
  const wrapped = `local __cm_loadstring = loadstring
local __cm_gate = function()
${source}
end
__cm_gate()
return __cm_loadstring(game:HttpGet(${JSON.stringify(stageUrl)}))()
`;

  return luaResponse(wrapped, 200);
}
