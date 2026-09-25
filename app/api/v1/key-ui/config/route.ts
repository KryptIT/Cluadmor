import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { noStoreJson } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureWorkspaceSchema();

  const serviceId = new URL(req.url).searchParams.get("serviceId") || "";
  if (!serviceId) return noStoreJson({ ok: false, error: "missing_service_id" }, 400);

  const rows = await sql`
    SELECT name, enabled, key_system_enabled, key_ui_mode
    FROM services
    WHERE id = ${serviceId}
    LIMIT 1
  `;

  const service = rows[0] as any;
  if (!service || !service.enabled) {
    return noStoreJson({ ok: false, error: "service_unavailable" }, 404);
  }

  return noStoreJson({
    ok: true,
    serviceName: service.name,
    keySystemEnabled: service.key_system_enabled !== false,
    keyUiMode: service.key_ui_mode === "CUSTOM" ? "CUSTOM" : "DEFAULT",
    libraryUrl: new URL("/ui/keysystem.lua", req.url).toString()
  });
}
