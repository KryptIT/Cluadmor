import { sql } from "@/lib/db";
import { encryptConfig } from "@/lib/config-crypto";
import { noStoreJson, sameDigest } from "@/lib/security";
import { PROVIDERS, type ProviderId } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize(serviceId: string, serviceSecret: string) {
  const rows = await sql`
    SELECT id, secret_hash, enabled
    FROM services
    WHERE id = ${serviceId}
    LIMIT 1
  `;
  const service = rows[0] as any;
  if (!service || !service.enabled || !sameDigest(serviceSecret, service.secret_hash)) return null;
  return service;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId") || "";
  const serviceSecret = req.headers.get("x-claudmor-service-secret") || "";
  if (!serviceId || !serviceSecret) return noStoreJson({ ok: false, error: "missing_credentials" }, 400);
  if (!await authorize(serviceId, serviceSecret)) return noStoreJson({ ok: false, error: "unauthorized" }, 401);

  const rows = await sql`
    SELECT provider, enabled, priority, config, api_key_ciphertext IS NOT NULL AS configured, updated_at
    FROM service_providers
    WHERE service_id = ${serviceId}
    ORDER BY priority ASC, provider ASC
  `;

  return noStoreJson({ ok: true, providers: rows });
}

export async function POST(req: Request) {
  let body: {
    serviceId?: string;
    serviceSecret?: string;
    provider?: ProviderId;
    enabled?: boolean;
    priority?: number;
    credentials?: Record<string, unknown>;
    config?: Record<string, unknown>;
  };

  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  if (!body.serviceId || !body.serviceSecret || !body.provider) {
    return noStoreJson({ ok: false, error: "missing_fields" }, 400);
  }
  if (!(body.provider in PROVIDERS)) {
    return noStoreJson({ ok: false, error: "unsupported_provider" }, 400);
  }
  if (!await authorize(body.serviceId, body.serviceSecret)) {
    return noStoreJson({ ok: false, error: "unauthorized" }, 401);
  }

  const encrypted = body.credentials && Object.keys(body.credentials).length
    ? encryptConfig(body.credentials)
    : null;

  await sql`
    INSERT INTO service_providers(service_id, provider, enabled, priority, api_key_ciphertext, config, updated_at)
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
