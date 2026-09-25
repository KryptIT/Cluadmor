import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { parseRewardClickId } from "@/lib/reward-click";
import { clientIp, digest, noStoreJson } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureWorkspaceSchema();

  const url = new URL(req.url);
  const rawClickId =
    url.searchParams.get("click_id") ||
    url.searchParams.get("clickId") ||
    url.searchParams.get("CLICK_ID") ||
    "";

  if (!rawClickId) {
    return noStoreJson({ ok: false, error: "missing_click_id" }, 400);
  }

  let sessionId = parseRewardClickId(rawClickId);
  let signed = !!sessionId;

  if (!sessionId) {
    const configuredSecret = (process.env.LOOTLABS_POSTBACK_SECRET || "").trim();
    const suppliedSecret = url.searchParams.get("secret") || "";

    if (!configuredSecret || suppliedSecret !== configuredSecret) {
      return noStoreJson({ ok: false, error: "unauthorized" }, 401);
    }

    sessionId = rawClickId;
  }

  const suppliedIp =
    url.searchParams.get("ip") ||
    url.searchParams.get("IP") ||
    clientIp(req.headers);

  const suppliedUniqueId =
    url.searchParams.get("unique_id") ||
    url.searchParams.get("uniqueId") ||
    url.searchParams.get("UNIQUE_ID") ||
    "";

  const uniqueId = suppliedUniqueId || `fallback_${digest(rawClickId + ":" + suppliedIp)}`;

  const completed = await sql`
    WITH valid AS (
      SELECT id, user_id, reward_type
      FROM reward_sessions
      WHERE id = ${sessionId}
        AND status = 'PENDING'
        AND expires_at > now()
    ),
    inserted AS (
      INSERT INTO lootlabs_completions(reward_session_id, unique_id, click_id, ip_hash)
      SELECT id, ${uniqueId}, ${rawClickId}, ${digest(suppliedIp)}
      FROM valid
      ON CONFLICT (unique_id) DO NOTHING
      RETURNING reward_session_id
    ),
    done AS (
      UPDATE reward_sessions r
      SET status = 'COMPLETED'
      FROM valid v
      WHERE r.id = v.id
        AND r.id IN (SELECT reward_session_id FROM inserted)
      RETURNING v.user_id, v.reward_type
    )
    SELECT user_id, reward_type FROM done
  `;

  if (!completed[0]) {
    return noStoreJson({
      ok: true,
      credited: false,
      signed,
      reason: "already_completed_expired_or_unknown"
    });
  }

  const reward = completed[0] as any;

  if (reward.reward_type === "SERVICE_CREATION") {
    await sql`
      UPDATE users
      SET service_creation_credits = service_creation_credits + 1
      WHERE id = ${reward.user_id}
    `;
  } else if (reward.reward_type === "OBFUSCATION") {
    await sql`
      UPDATE users
      SET obfuscation_credits = obfuscation_credits + 1
      WHERE id = ${reward.user_id}
    `;
  }

  return noStoreJson({
    ok: true,
    credited: true,
    signed,
    type: reward.reward_type
  });
}
