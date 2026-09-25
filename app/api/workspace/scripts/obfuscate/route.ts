import { runClaudium } from "@/lib/claudium";
import { decryptConfig, encryptConfig } from "@/lib/config-crypto";
import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { noStoreJson } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildGuard(serviceId: string, source: string) {
  return `local __cm = (getgenv and getgenv()) or _G
if type(__cm.SCRIPT_KEY) ~= "string" or __cm.SCRIPT_KEY == "" then error("[Claudmor] SCRIPT_KEY missing", 0) end
if __cm.__CLAUDMOR_AUTHORIZED ~= true then error("[Claudmor] unauthorized execution", 0) end
if __cm.__CLAUDMOR_SERVICE ~= "${serviceId}" then error("[Claudmor] invalid service", 0) end
${source}`;
}

export async function POST(req: Request) {
  await ensureWorkspaceSchema();

  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  let body: { scriptId?: string; preset?: string };
  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  if (!body.scriptId) {
    return noStoreJson({ ok: false, error: "missing_script_id" }, 400);
  }

  const rows = await sql`
    SELECT
      ss.id,
      ss.service_id,
      ss.source_ciphertext,
      ss.obfuscation_preset
    FROM service_scripts ss
    JOIN services s ON s.id = ss.service_id
    WHERE ss.id = ${body.scriptId}
      AND s.owner_id = ${identity.userId}
    LIMIT 1
  `;

  if (!rows[0]) {
    return noStoreJson({ ok: false, error: "script_not_owned" }, 403);
  }

  const script = rows[0] as any;
  const raw = decryptConfig(script.source_ciphertext) as { source?: string };
  const source = String(raw.source || "");
  const preset = String(body.preset || script.obfuscation_preset || "executor");

  if (!source) return noStoreJson({ ok: false, error: "empty_source" }, 400);

  let charged = false;

  const entitlementRows = await sql`
    SELECT unlimited_obfuscation_credits
    FROM users
    WHERE id = ${identity.userId}
    LIMIT 1
  `;

  const unlimitedCredit = !!(entitlementRows[0] as any)?.unlimited_obfuscation_credits;

  if (!identity.bypassRewards && !unlimitedCredit) {
    const debit = await sql`
      UPDATE users
      SET obfuscation_credits = obfuscation_credits - 1
      WHERE id = ${identity.userId}
        AND obfuscation_credits > 0
      RETURNING obfuscation_credits
    `;

    if (!debit[0]) {
      return noStoreJson({ ok: false, error: "obfuscation_credit_required" }, 402);
    }

    charged = true;
  }

  const result = await runClaudium(buildGuard(script.service_id, source), preset);

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

  await sql`
    UPDATE service_scripts
    SET
      obfuscated_ciphertext = ${encryptConfig({ source: result.output })},
      obfuscated_at = now(),
      obfuscation_preset = ${preset}
    WHERE id = ${script.id}
  `;

  return noStoreJson({
    ok: true,
    output: result.output,
    bypassedCredit: identity.bypassRewards || unlimitedCredit,
    unlimitedCredit
  });
}
