import { runClaudium } from "@/lib/claudium";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { sql } from "@/lib/db";
import { buildLoader } from "@/lib/loader-template";
import { noStoreJson } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownedService(req: Request, serviceId: string) {
  const identity = await workspaceIdentity(req);
  if (!identity) return { error: noStoreJson({ ok: false, error: "login_required" }, 401) };

  const rows = await sql`
    SELECT id, name, enabled
    FROM services
    WHERE id = ${serviceId}
      AND owner_id = ${identity.userId}
    LIMIT 1
  `;

  if (!rows[0]) {
    return { error: noStoreJson({ ok: false, error: "service_not_owned" }, 403) };
  }

  return { identity, service: rows[0] as any };
}

export async function GET(req: Request) {
  await ensureWorkspaceSchema();
  const serviceId = new URL(req.url).searchParams.get("serviceId") || "";
  if (!serviceId) return noStoreJson({ ok: false, error: "missing_service_id" }, 400);

  const owned = await ownedService(req, serviceId);
  if ("error" in owned) return owned.error;

  const origin = new URL(req.url).origin;
  const source = buildLoader(origin, serviceId);

  return noStoreJson({
    ok: true,
    protected: false,
    service: owned.service,
    source
  });
}

export async function POST(req: Request) {
  await ensureWorkspaceSchema();
  let body: { serviceId?: string; protect?: boolean };
  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  if (!body.serviceId) return noStoreJson({ ok: false, error: "missing_service_id" }, 400);

  const owned = await ownedService(req, body.serviceId);
  if ("error" in owned) return owned.error;

  const origin = new URL(req.url).origin;
  const loader = buildLoader(origin, body.serviceId);

  if (body.protect === false) {
    return noStoreJson({
      ok: true,
      protected: false,
      service: owned.service,
      source: loader
    });
  }

  const result = await runClaudium(loader, "executor");

  if (!result.ok) {
    return noStoreJson({
      ok: false,
      error: result.error,
      detail: result.detail || null,
      upstreamStatus: result.status
    }, result.status >= 400 && result.status < 600 ? result.status : 502);
  }

  return noStoreJson({
    ok: true,
    protected: true,
    service: owned.service,
    source: result.output
  });
}
