import { encryptConfig } from "@/lib/config-crypto";
import { sql } from "@/lib/db";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import { noStoreJson } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  const serviceId = new URL(req.url).searchParams.get("serviceId");
  if (!serviceId) return noStoreJson({ ok: false, error: "missing_service_id" }, 400);

  const owned = await sql`
    SELECT id FROM services
    WHERE id = ${serviceId} AND owner_id = ${identity.userId}
    LIMIT 1
  `;
  if (!owned[0]) return noStoreJson({ ok: false, error: "service_not_owned" }, 403);

  const rows = await sql`
    SELECT provider, enabled, priority, config,
           (api_key_ciphertext IS NOT NULL) AS configured,
           updated_at
    FROM service_providers
    WHERE service_id = ${serviceId}
    ORDER BY priority ASC, provider ASC
  `;

  return noStoreJson({ ok: true, providers: rows });
}

export async function POST(req: Request) {
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  let body: {
    serviceId?: string;
    provider?: ProviderId;
    enabled?: boolean;
    priority?: number;
    credentials?: Record<string, unknown>;
    config?: Record<string, unknown>;
  };

  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  if (!body.serviceId || !body.provider) {
    return noStoreJson({ ok: false, error: "missing_fields" }, 400);
  }

  if (!(body.provider in PROVIDERS)) {
    return noStoreJson({ ok: false, error: "unsupported_provider" }, 400);
  }

  const owned = await sql`
    SELECT id FROM services
    WHERE id = ${body.serviceId} AND owner_id = ${identity.userId}
    LIMIT 1
  `;
  if (!owned[0]) return noStoreJson({ ok: false, error: "service_not_owned" }, 403);

  const encrypted = body.credentials && Object.keys(body.credentials).length > 0
    ? encryptConfig(body.credentials)
    : null;

  await sql`
    INSERT INTO service_providers(
      service_id, provider, enabled, priority, api_key_ciphertext, config, updated_at
    )
    VALUES (
      ${body.serviceId},
      ${body.provider},
      ${body.enabled !== false},
      ${Math.max(0, Math.floor(body.priority || 0))},
      ${encrypted},
      ${JSON.stringify(body.config || {})}::jsonb,
      now()
    )
    ON CONFLICT(service_id, provider)
    DO UPDATE SET
      enabled = EXCLUDED.enabled,
      priority = EXCLUDED.priority,
      api_key_ciphertext = COALESCE(EXCLUDED.api_key_ciphertext, service_providers.api_key_ciphertext),
      config = EXCLUDED.config,
      updated_at = now()
  `;

  return noStoreJson({ ok: true });
}
