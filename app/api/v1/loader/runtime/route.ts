import { decryptConfig } from "@/lib/config-crypto";
import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { clientIp, digest, normalizeHwid } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  serviceId?: string;
  key?: string;
  hwid?: string;
  robloxUserId?: string;
  robloxUsername?: string;
  discordUserId?: string;
};

function text(body: string, status: number) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Vary": "X-Claudmor-Client, X-Claudmor-Protocol"
    }
  });
}

export async function POST(req: Request) {
  await ensureWorkspaceSchema();

  if (
    req.headers.get("x-claudmor-client") !== "executor" ||
    req.headers.get("x-claudmor-protocol") !== "1"
  ) {
    return text("forbidden_client", 403);
  }

  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
  const secFetchMode = req.headers.get("sec-fetch-mode");
  const secFetchSite = req.headers.get("sec-fetch-site");

  if (
    userAgent.includes("mozilla/") &&
    (secFetchMode || secFetchSite)
  ) {
    return text("browser_client_rejected", 403);
  }

  let body: Body;

  try {
    body = await req.json();
  } catch {
    return text("invalid_json", 400);
  }

  if (!body.serviceId || !body.key || !body.hwid) {
    return text("missing_fields", 400);
  }

  const services = await sql`
    SELECT
      id,
      enabled,
      require_hwid,
      require_roblox_user_id,
      require_roblox_username,
      require_discord_user_id
    FROM services
    WHERE id = ${body.serviceId}
    LIMIT 1
  `;

  const service = services[0] as any;

  if (!service || !service.enabled) {
    return text("invalid_service", 404);
  }

  const hwidHash = digest(normalizeHwid(body.hwid));
  const keyHash = digest(body.key);

  const keys = await sql`
    SELECT
      id,
      hwid_hash,
      roblox_user_id,
      roblox_username,
      discord_user_id,
      expires_at,
      revoked_at
    FROM license_keys
    WHERE service_id = ${service.id}
      AND key_hash = ${keyHash}
    LIMIT 1
  `;

  const key = keys[0] as any;

  if (
    !key ||
    key.revoked_at ||
    (key.expires_at && new Date(key.expires_at).getTime() <= Date.now())
  ) {
    return text("invalid_key", 401);
  }

  if (service.require_hwid) {
    if (key.hwid_hash && key.hwid_hash !== hwidHash) {
      return text("hwid_mismatch", 403);
    }

    if (!key.hwid_hash) {
      await sql`
        UPDATE license_keys
        SET hwid_hash = ${hwidHash}
        WHERE id = ${key.id}
          AND hwid_hash IS NULL
      `;
    }
  }

  if (
    service.require_roblox_user_id &&
    String(key.roblox_user_id || "") !== String(body.robloxUserId || "")
  ) {
    return text("roblox_user_id_mismatch", 403);
  }

  if (
    service.require_roblox_username &&
    String(key.roblox_username || "").toLowerCase() !==
      String(body.robloxUsername || "").toLowerCase()
  ) {
    return text("roblox_username_mismatch", 403);
  }

  if (
    service.require_discord_user_id &&
    String(key.discord_user_id || "") !== String(body.discordUserId || "")
  ) {
    return text("discord_user_id_mismatch", 403);
  }

  const loaders = await sql`
    SELECT loader_ciphertext
    FROM service_loaders
    WHERE service_id = ${service.id}
    LIMIT 1
  `;

  if (!loaders[0]) {
    return text("loader_not_published", 404);
  }

  const decoded = decryptConfig((loaders[0] as any).loader_ciphertext) as {
    source?: string;
  };

  const source = String(decoded.source || "");

  if (!source) {
    return text("loader_unavailable", 503);
  }

  await sql`
    INSERT INTO audit_events(service_id, key_id, kind, ip_hash)
    VALUES (
      ${service.id},
      ${key.id},
      'LOADER_BOOTSTRAP',
      ${digest(clientIp(req.headers))}
    )
  `;

  return text(source, 200);
}
