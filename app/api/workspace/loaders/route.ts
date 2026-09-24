import { runClaudium } from "@/lib/claudium";
import { decryptConfig, encryptConfig } from "@/lib/config-crypto";
import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { buildLoader } from "@/lib/loader-template";
import { noStoreJson } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownedService(req: Request, serviceId: string) {
  await ensureWorkspaceSchema();

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

function publicInfo(req: Request, serviceId: string) {
  const origin = new URL(req.url).origin.replace(/\/+$/, "");
  const publicUrl = `${origin}/l/${serviceId}`;
  return {
    publicUrl,
    oneLiner: `loadstring(game:HttpGet("${publicUrl}"))()`
  };
}

export async function GET(req: Request) {
  const serviceId = new URL(req.url).searchParams.get("serviceId") || "";
  if (!serviceId) return noStoreJson({ ok: false, error: "missing_service_id" }, 400);

  const owned = await ownedService(req, serviceId);
  if ("error" in owned) return owned.error;

  const rows = await sql`
    SELECT loader_ciphertext, updated_at
    FROM service_loaders
    WHERE service_id = ${serviceId}
    LIMIT 1
  `;

  const info = publicInfo(req, serviceId);

  return noStoreJson({
    ok: true,
    service: owned.service,
    published: !!rows[0],
    updatedAt: rows[0] ? (rows[0] as any).updated_at : null,
    publicUrl: info.publicUrl,
    oneLiner: rows[0] ? info.oneLiner : ""
  });
}

export async function POST(req: Request) {
  await ensureWorkspaceSchema();

  let body: { serviceId?: string };
  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  if (!body.serviceId) return noStoreJson({ ok: false, error: "missing_service_id" }, 400);

  const owned = await ownedService(req, body.serviceId);
  if ("error" in owned) return owned.error;

  const origin = new URL(req.url).origin;
  const readableLoader = buildLoader(origin, body.serviceId);
  const result = await runClaudium(readableLoader, "executor");

  if (!result.ok) {
    return noStoreJson({
      ok: false,
      error: result.error,
      detail: result.detail || null,
      upstreamStatus: result.status
    }, result.status >= 400 && result.status < 600 ? result.status : 502);
  }

  await sql`
    INSERT INTO service_loaders(service_id, loader_ciphertext, updated_at)
    VALUES (
      ${body.serviceId},
      ${encryptConfig({ source: result.output })},
      now()
    )
    ON CONFLICT(service_id)
    DO UPDATE SET
      loader_ciphertext = EXCLUDED.loader_ciphertext,
      updated_at = now()
  `;

  const info = publicInfo(req, body.serviceId);

  return noStoreJson({
    ok: true,
    published: true,
    updatedAt: new Date().toISOString(),
    ...info
  });
}
