import { runClaudium } from "@/lib/claudium";
import { sql } from "@/lib/db";
import { noStoreJson } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  let body: { source?: string; preset?: string };
  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  const source = String(body.source || "");
  if (!source || source.length > 2_000_000) {
    return noStoreJson({ ok: false, error: "invalid_source" }, 400);
  }

  let charged = false;

  if (!identity.bypassRewards) {
    const debit = await sql`
      UPDATE users
      SET obfuscation_credits = obfuscation_credits - 1
      WHERE id = ${identity.userId} AND obfuscation_credits > 0
      RETURNING obfuscation_credits
    `;

    if (!debit[0]) {
      return noStoreJson({ ok: false, error: "obfuscation_credit_required" }, 402);
    }

    charged = true;
  }

  const result = await runClaudium(source, body.preset || "executor");

  if (!result.ok) {
    if (charged) {
      await sql`
        UPDATE users
        SET obfuscation_credits = obfuscation_credits + 1
        WHERE id = ${identity.userId}
      `;
    }

    return noStoreJson({
      ok: false,
      error: result.error,
      detail: result.detail || null,
      upstreamStatus: result.status
    }, result.status >= 400 && result.status < 600 ? result.status : 502);
  }

  return noStoreJson({
    ok: true,
    output: result.output,
    bypassedCredit: identity.bypassRewards
  });
}
