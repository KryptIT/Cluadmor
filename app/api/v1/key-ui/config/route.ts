import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { noStoreJson } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureWorkspaceSchema();

  const serviceId = new URL(req.url).searchParams.get("serviceId") || "";
  if (!serviceId) {
    return noStoreJson({ ok: false, error: "missing_service_id" }, 400);
  }

  const rows = await sql`
    SELECT name, enabled, key_system_enabled, key_ui_mode
    FROM services
    WHERE id = ${serviceId}
    LIMIT 1
  `;

  const providerRows = await sql`
    SELECT provider, config
    FROM service_providers
    WHERE service_id = ${serviceId}
      AND enabled = true
      AND NULLIF(BTRIM(COALESCE(config->>'linkTemplate', '')), '') IS NOT NULL
    ORDER BY priority ASC, updated_at DESC
    LIMIT 1
  `;

  const service = rows[0] as any;
  if (!service || !service.enabled) {
    return noStoreJson({ ok: false, error: "service_unavailable" }, 404);
  }

  const provider = providerRows[0] as any;
  const getKeyUrl =
    provider && typeof provider.config?.linkTemplate === "string"
      ? provider.config.linkTemplate.trim()
      : "";

  return noStoreJson({
    ok: true,
    serviceName: service.name,
    keySystemEnabled: service.key_system_enabled !== false,
    customUiEnabled: service.key_ui_mode === "CUSTOM",
    keyUiMode: service.key_ui_mode === "CUSTOM" ? "CUSTOM" : "DEFAULT",
    libraryUrl: new URL("/sdk/library.lua", req.url).toString(),
    getKeyUrl: /^https?:\/\//i.test(getKeyUrl) ? getKeyUrl : "",
    getKeyProvider: provider?.provider || null
  });
}
