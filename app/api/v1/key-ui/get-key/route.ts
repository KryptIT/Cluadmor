import { decryptConfig } from "@/lib/config-crypto";
import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { digest, noStoreJson, opaque } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appendLootLabsData(base: string, encrypted: string) {
  const hashIndex = base.indexOf("#");
  let beforeHash = hashIndex === -1 ? base : base.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : base.slice(hashIndex);

  beforeHash = beforeHash
    .replace(/([?&])data=[^&]*/i, "$1")
    .replace(/[?&]$/, "");

  const join = beforeHash.includes("?") ? "&" : "?";
  return beforeHash + join + "data=" + encrypted + hash;
}

function errorPage(message: string, status = 500) {
  const safe = message.replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch] || ch));

  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Claudmor</title></head><body style="margin:0;background:#07090b;color:#e7f1f3;font:14px system-ui;display:grid;place-items:center;min-height:100vh"><div style="max-width:560px;padding:28px;border:1px solid #183b42;border-radius:14px;background:#0b1013"><b>Could not create key link</b><p style="color:#9fb1b5">${safe}</p></div></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow, noarchive"
      }
    }
  );
}

export async function GET(req: Request) {
  await ensureWorkspaceSchema();

  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId") || "";
  if (!serviceId) return errorPage("Missing service ID.", 400);

  const rows = await sql`
    SELECT
      s.id,
      s.name,
      s.enabled,
      s.key_system_enabled,
      sp.provider,
      sp.api_key_ciphertext,
      sp.config
    FROM services s
    JOIN service_providers sp ON sp.service_id = s.id
    WHERE s.id = ${serviceId}
      AND s.enabled = true
      AND s.key_system_enabled = true
      AND sp.enabled = true
      AND NULLIF(BTRIM(COALESCE(sp.config->>'linkTemplate', '')), '') IS NOT NULL
    ORDER BY sp.priority ASC, sp.updated_at DESC
    LIMIT 1
  `;

  const row = rows[0] as any;
  if (!row) return errorPage("No enabled key provider is configured for this service.", 404);

  const provider = String(row.provider || "");
  const template = String(row.config?.linkTemplate || "").trim();

  if (!/^https?:\/\//i.test(template)) {
    return errorPage("The provider example link is not a valid URL.", 500);
  }

  if (provider !== "lootlabs") {
    return Response.redirect(template, 302);
  }

  if (!row.api_key_ciphertext) {
    return errorPage("LootLabs API key is missing.", 500);
  }

  let apiKey = "";
  try {
    const credentials = decryptConfig(String(row.api_key_ciphertext)) as { apiKey?: string };
    apiKey = String(credentials?.apiKey || "").trim();
  } catch {
    return errorPage("LootLabs API key could not be decrypted.", 500);
  }

  if (!apiKey) return errorPage("LootLabs API key is missing.", 500);

  const token = opaque("PKS", 32);
  const tokenHash = digest("provider-key:" + token);

  await sql`
    INSERT INTO provider_key_sessions(service_id, provider, token_hash, expires_at)
    VALUES (
      ${serviceId},
      'lootlabs',
      ${tokenHash},
      now() + interval '20 minutes'
    )
  `;

  const origin = new URL(req.url).origin;
  const destination = new URL("/key/claim", origin);
  destination.searchParams.set("token", token);

  let upstream: Response;
  try {
    upstream = await fetch("https://creators.lootlabs.gg/api/public/url_encryptor", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        destination_url: destination.toString(),
        api_token: apiKey
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000)
    });
  } catch (error) {
    await sql`DELETE FROM provider_key_sessions WHERE token_hash = ${tokenHash}`;
    return errorPage(
      error instanceof Error ? error.message : "Could not reach LootLabs.",
      502
    );
  }

  const raw = await upstream.text();
  let data: any = null;
  try { data = JSON.parse(raw); } catch {}

  const encrypted =
    typeof data?.message === "string"
      ? data.message.trim()
      : "";

  if (!upstream.ok || !encrypted) {
    await sql`DELETE FROM provider_key_sessions WHERE token_hash = ${tokenHash}`;
    const detail =
      typeof data?.message === "string"
        ? data.message
        : typeof data?.error === "string"
          ? data.error
          : raw.slice(0, 500);

    return errorPage(detail || `LootLabs returned HTTP ${upstream.status}.`, 502);
  }

  return Response.redirect(appendLootLabsData(template, encrypted), 302);
}
