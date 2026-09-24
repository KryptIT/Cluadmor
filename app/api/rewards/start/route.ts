import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { noStoreJson } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withPuid(base: string, sessionId: string) {
  const join = base.includes("?") ? "&" : "?";
  return base + join + "puid=" + encodeURIComponent(sessionId);
}

async function expireSession(id: string) {
  try {
    await sql`
      UPDATE reward_sessions
      SET status = 'EXPIRED'
      WHERE id = ${id}
    `;
  } catch {}
}

export async function POST(req: Request) {
  await ensureWorkspaceSchema();

  const identity = await workspaceIdentity(req);
  if (!identity) {
    return noStoreJson({ ok: false, error: "login_required" }, 401);
  }

  if (identity.bypassRewards) {
    return noStoreJson({ ok: true, bypass: true });
  }

  let body: {
    type?: "SERVICE_CREATION" | "OBFUSCATION";
    returnTo?: string;
  };

  try {
    body = await req.json();
  } catch {
    return noStoreJson({ ok: false, error: "invalid_json" }, 400);
  }

  if (!body.type || !["SERVICE_CREATION", "OBFUSCATION"].includes(body.type)) {
    return noStoreJson({ ok: false, error: "invalid_reward_type" }, 400);
  }

  const sessions = await sql`
    INSERT INTO reward_sessions(user_id, reward_type, expires_at)
    VALUES (
      ${identity.userId},
      ${body.type},
      now() + interval '30 minutes'
    )
    RETURNING id, reward_type, expires_at
  `;

  const session = sessions[0] as any;
  const sessionId = String(session.id);

  /*
   * Preferred mode:
   * Create one LootLabs link in the LootLabs dashboard and put the resulting
   * loot-link.com URL in LOOTLABS_REWARD_URL. Claudmor only appends ?puid=...
   * for each reward session.
   */
  const configuredRewardUrl = (process.env.LOOTLABS_REWARD_URL || "").trim();

  if (configuredRewardUrl) {
    if (!/^https:\/\//i.test(configuredRewardUrl)) {
      await expireSession(sessionId);
      return noStoreJson({
        ok: false,
        error: "lootlabs_reward_url_invalid",
        detail: "LOOTLABS_REWARD_URL must be a full https:// LootLabs link."
      }, 503);
    }

    return noStoreJson({
      ok: true,
      rewardSessionId: sessionId,
      url: withPuid(configuredRewardUrl, sessionId),
      expiresAt: session.expires_at,
      mode: "configured_link"
    });
  }

  /*
   * Fallback mode:
   * Dynamically create a link through LootLabs' public content_locker API.
   */
  const token = (process.env.LOOTLABS_API_TOKEN || "").trim();

  if (!token) {
    await expireSession(sessionId);
    return noStoreJson({
      ok: false,
      error: "lootlabs_not_configured",
      detail: "Set LOOTLABS_REWARD_URL or LOOTLABS_API_TOKEN."
    }, 503);
  }

  const origin = new URL(req.url).origin;

  const allowedReturn =
    body.type === "SERVICE_CREATION"
      ? "/dashboard/services"
      : body.returnTo === "/dashboard/credits"
        ? "/dashboard/credits"
        : "/dashboard/scripts";

  const destinationUrl = new URL(allowedReturn, origin);
  destinationUrl.searchParams.set("reward", sessionId);
  const destination = destinationUrl.toString();

  const requestBody = {
    title: body.type === "SERVICE_CREATION"
      ? "Claudmor Service"
      : "Claudium Credit",
    url: destination,
    tier_id: 3,
    number_of_tasks: 1,
    theme: 1
  };

  try {
    const upstream = await fetch(
      "https://creators.lootlabs.gg/api/public/content_locker",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(requestBody),
        cache: "no-store",
        signal: AbortSignal.timeout(12000)
      }
    );

    const raw = await upstream.text();

    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {}

    const messageItem =
      Array.isArray(data?.message) && data.message.length > 0
        ? data.message[0]
        : data?.message;

    const lootUrl =
      typeof messageItem?.loot_url === "string"
        ? messageItem.loot_url
        : "";

    if (!upstream.ok || !lootUrl) {
      await expireSession(sessionId);

      const lootLabsMessage =
        typeof data?.message === "string"
          ? data.message
          : Array.isArray(data?.message)
            ? JSON.stringify(data.message)
            : typeof data?.error === "string"
              ? data.error
              : raw.slice(0, 500);

      return noStoreJson({
        ok: false,
        error: "lootlabs_link_failed",
        detail: lootLabsMessage || `LootLabs returned HTTP ${upstream.status}.`,
        lootlabsStatus: upstream.status
      }, 502);
    }

    return noStoreJson({
      ok: true,
      rewardSessionId: sessionId,
      url: withPuid(lootUrl, sessionId),
      expiresAt: session.expires_at,
      mode: "api_created_link"
    });
  } catch (error) {
    await expireSession(sessionId);

    return noStoreJson({
      ok: false,
      error: "lootlabs_unavailable",
      detail: error instanceof Error
        ? error.message
        : "Could not reach LootLabs."
    }, 502);
  }
}
