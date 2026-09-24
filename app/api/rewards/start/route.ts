import { sql } from "@/lib/db";
import { noStoreJson } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  if (identity.bypassRewards) {
    return noStoreJson({ ok: true, bypass: true });
  }

  let body: { type?: "SERVICE_CREATION" | "OBFUSCATION" };
  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  if (!body.type || !["SERVICE_CREATION", "OBFUSCATION"].includes(body.type)) {
    return noStoreJson({ ok: false, error: "invalid_reward_type" }, 400);
  }

  const token = process.env.LOOTLABS_API_TOKEN;
  if (!token) return noStoreJson({ ok: false, error: "lootlabs_not_configured" }, 503);

  const sessions = await sql`
    INSERT INTO reward_sessions(user_id, reward_type, expires_at)
    VALUES (${identity.userId}, ${body.type}, now() + interval '20 minutes')
    RETURNING id, reward_type, expires_at
  `;
  const session = sessions[0] as any;

  const origin = new URL(req.url).origin;
  const destination = body.type === "SERVICE_CREATION"
    ? `${origin}/dashboard/services?reward=${session.id}`
    : `${origin}/dashboard/scripts?reward=${session.id}`;

  try {
    const upstream = await fetch("https://creators.lootlabs.gg/api/public/content_locker", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: body.type === "SERVICE_CREATION" ? "Claudmor Service" : "Claudium Credit",
        url: destination,
        tier_id: 3,
        number_of_tasks: 1,
        theme: 1
      }),
      cache: "no-store"
    });

    const data = await upstream.json() as any;
    const base = data?.message?.loot_url;

    if (!upstream.ok || !base) {
      await sql`UPDATE reward_sessions SET status = 'EXPIRED' WHERE id = ${session.id}`;
      return noStoreJson({ ok: false, error: "lootlabs_link_failed" }, 502);
    }

    const join = String(base).includes("?") ? "&" : "?";
    return noStoreJson({
      ok: true,
      rewardSessionId: session.id,
      url: String(base) + join + "puid=" + encodeURIComponent(String(session.id)),
      expiresAt: session.expires_at
    });
  } catch {
    await sql`UPDATE reward_sessions SET status = 'EXPIRED' WHERE id = ${session.id}`;
    return noStoreJson({ ok: false, error: "lootlabs_unavailable" }, 502);
  }
}
