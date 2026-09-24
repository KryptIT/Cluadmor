import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { clientIp, digest, noStoreJson } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureWorkspaceSchema();
  const url = new URL(req.url);
  const configuredSecret = process.env.LOOTLABS_POSTBACK_SECRET || "";

  if (configuredSecret) {
    const got = url.searchParams.get("secret") || "";
    if (got !== configuredSecret) return noStoreJson({ ok: false, error: "unauthorized" }, 401);
  }

  const clickId = url.searchParams.get("click_id") || "";
  const uniqueId = url.searchParams.get("unique_id") || "";
  const suppliedIp = url.searchParams.get("ip") || clientIp(req.headers);

  if (!clickId || !uniqueId) {
    return noStoreJson({ ok: false, error: "missing_fields" }, 400);
  }

  const completed = await sql`
    WITH valid AS (
      SELECT id, user_id, reward_type
      FROM reward_sessions
      WHERE id = ${clickId}
        AND status = 'PENDING'
        AND expires_at > now()
    ),
    inserted AS (
      INSERT INTO lootlabs_completions(reward_session_id, unique_id, click_id, ip_hash)
      SELECT id, ${uniqueId}, ${clickId}, ${digest(suppliedIp)}
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
    return noStoreJson({ ok: true, credited: false });
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

  return noStoreJson({ ok: true, credited: true, type: reward.reward_type });
}
