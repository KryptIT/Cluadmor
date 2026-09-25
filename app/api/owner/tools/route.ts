import { runClaudium } from "@/lib/claudium";
import { decryptConfig, encryptConfig } from "@/lib/config-crypto";
import { sql } from "@/lib/db";
import { buildLoader } from "@/lib/loader-template";
import { buildPublicBootstrap } from "@/lib/public-bootstrap";
import { noStoreJson } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildGuard(serviceId: string, source: string) {
  return `local __cm = _G\nif type(getgenv) == "function" then\n    local __ok, __env = pcall(getgenv)\n    if __ok and type(__env) == "table" then __cm = __env end\nend
if type(__cm.SCRIPT_KEY) ~= "string" or __cm.SCRIPT_KEY == "" then error("[Claudmor] SCRIPT_KEY missing", 0) end
if __cm.__CLAUDMOR_AUTHORIZED ~= true then error("[Claudmor] unauthorized execution", 0) end
if __cm.__CLAUDMOR_SERVICE ~= "${serviceId}" then error("[Claudmor] invalid service", 0) end
${source}`;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
) {
  const output: R[] = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run())
  );

  return output;
}

async function requireOwner(req: Request) {
  const identity = await workspaceIdentity(req);

  if (!identity) {
    return { error: noStoreJson({ ok: false, error: "login_required" }, 401) };
  }

  if (!identity.owner) {
    return { error: noStoreJson({ ok: false, error: "owner_required" }, 403) };
  }

  return { identity };
}

export async function POST(req: Request) {
  const owned = await requireOwner(req);
  if ("error" in owned) return owned.error;

  let body: { action?: string };

  try {
    body = await req.json();
  } catch {
    return noStoreJson({ ok: false, error: "invalid_json" }, 400);
  }

  const action = String(body.action || "");

  if (action === "reobfuscate_all_users_scripts") {
    const rows = await sql`
      SELECT
        ss.id,
        ss.name,
        ss.service_id,
        ss.source_ciphertext,
        ss.obfuscation_preset,
        s.owner_id,
        u.email AS owner_email,
        u.username AS owner_username
      FROM service_scripts ss
      JOIN services s ON s.id = ss.service_id
      JOIN users u ON u.id = s.owner_id
      ORDER BY ss.created_at ASC
    `;

    const results = await mapLimit(rows as any[], 3, async script => {
      try {
        const raw = decryptConfig(script.source_ciphertext) as { source?: string };
        const source = String(raw.source || "");

        if (!source) {
          return {
            id: script.id,
            name: script.name,
            ownerId: script.owner_id,
            owner: script.owner_email || script.owner_username || script.owner_id,
            ok: false,
            error: "empty_source"
          };
        }

        const result = await runClaudium(
          buildGuard(String(script.service_id), source),
          String(script.obfuscation_preset || "executor"),
          true
        );

        if (!result.ok) {
          return {
            id: script.id,
            name: script.name,
            ownerId: script.owner_id,
            owner: script.owner_email || script.owner_username || script.owner_id,
            ok: false,
            error: result.error,
            detail: result.detail || null
          };
        }

        await sql`
          UPDATE service_scripts
          SET obfuscated_ciphertext = ${encryptConfig({ source: result.output })},
              obfuscated_at = now()
          WHERE id = ${script.id}
        `;

        return {
          id: script.id,
          name: script.name,
          ownerId: script.owner_id,
          owner: script.owner_email || script.owner_username || script.owner_id,
          ok: true
        };
      } catch (error) {
        return {
          id: script.id,
          name: script.name,
          ownerId: script.owner_id,
          owner: script.owner_email || script.owner_username || script.owner_id,
          ok: false,
          error: error instanceof Error ? error.message : "unknown_error"
        };
      }
    });

    return noStoreJson({
      ok: true,
      action,
      scope: "all_users",
      total: results.length,
      succeeded: results.filter((x: any) => x.ok).length,
      failed: results.filter((x: any) => !x.ok)
    });
  }

  if (action === "reobfuscate_all_scripts") {
    const rows = await sql`
      SELECT ss.id, ss.name, ss.service_id, ss.source_ciphertext,
             ss.obfuscation_preset
      FROM service_scripts ss
      JOIN services s ON s.id = ss.service_id
      WHERE s.owner_id = ${owned.identity.userId}
      ORDER BY ss.created_at ASC
    `;

    const results = await mapLimit(rows as any[], 3, async script => {
      try {
        const raw = decryptConfig(script.source_ciphertext) as { source?: string };
        const source = String(raw.source || "");

        if (!source) {
          return {
            id: script.id,
            name: script.name,
            ok: false,
            error: "empty_source"
          };
        }

        const result = await runClaudium(
          buildGuard(String(script.service_id), source),
          String(script.obfuscation_preset || "executor"),
          true
        );

        if (!result.ok) {
          return {
            id: script.id,
            name: script.name,
            ok: false,
            error: result.error,
            detail: result.detail || null
          };
        }

        await sql`
          UPDATE service_scripts
          SET obfuscated_ciphertext = ${encryptConfig({ source: result.output })},
              obfuscated_at = now()
          WHERE id = ${script.id}
        `;

        return { id: script.id, name: script.name, ok: true };
      } catch (error) {
        return {
          id: script.id,
          name: script.name,
          ok: false,
          error: error instanceof Error ? error.message : "unknown_error"
        };
      }
    });

    return noStoreJson({
      ok: true,
      action,
      total: results.length,
      succeeded: results.filter((x: any) => x.ok).length,
      failed: results.filter((x: any) => !x.ok)
    });
  }

  if (action === "republish_all_users_loaders") {
    const rows = await sql`
      SELECT
        s.id,
        s.name,
        s.owner_id,
        u.email AS owner_email,
        u.username AS owner_username
      FROM services s
      JOIN service_loaders sl ON sl.service_id = s.id
      JOIN users u ON u.id = s.owner_id
      ORDER BY s.created_at ASC
    `;

    const origin = new URL(req.url).origin.replace(/\/+$/, "");

    const results = await mapLimit(rows as any[], 2, async service => {
      try {
        const [loaderResult, bootstrapResult] = await Promise.all([
          runClaudium(buildLoader(origin, String(service.id)), "executor", true),
          runClaudium(buildPublicBootstrap(origin, String(service.id)), "executor", true)
        ]);

        if (!loaderResult.ok) {
          return {
            id: service.id,
            name: service.name,
            ownerId: service.owner_id,
            owner: service.owner_email || service.owner_username || service.owner_id,
            ok: false,
            error: loaderResult.error,
            detail: loaderResult.detail || null
          };
        }

        if (!bootstrapResult.ok) {
          return {
            id: service.id,
            name: service.name,
            ownerId: service.owner_id,
            owner: service.owner_email || service.owner_username || service.owner_id,
            ok: false,
            error: bootstrapResult.error,
            detail: bootstrapResult.detail || null
          };
        }

        await sql`
          UPDATE service_loaders
          SET loader_ciphertext = ${encryptConfig({ source: loaderResult.output })},
              bootstrap_ciphertext = ${encryptConfig({ source: bootstrapResult.output })},
              updated_at = now()
          WHERE service_id = ${service.id}
        `;

        return {
          id: service.id,
          name: service.name,
          ownerId: service.owner_id,
          owner: service.owner_email || service.owner_username || service.owner_id,
          ok: true
        };
      } catch (error) {
        return {
          id: service.id,
          name: service.name,
          ownerId: service.owner_id,
          owner: service.owner_email || service.owner_username || service.owner_id,
          ok: false,
          error: error instanceof Error ? error.message : "unknown_error"
        };
      }
    });

    return noStoreJson({
      ok: true,
      action,
      scope: "all_users",
      total: results.length,
      succeeded: results.filter((x: any) => x.ok).length,
      failed: results.filter((x: any) => !x.ok)
    });
  }

  if (action === "republish_all_loaders") {
    const rows = await sql`
      SELECT s.id, s.name
      FROM services s
      JOIN service_loaders sl ON sl.service_id = s.id
      WHERE s.owner_id = ${owned.identity.userId}
      ORDER BY s.created_at ASC
    `;

    const origin = new URL(req.url).origin.replace(/\/+$/, "");

    const results = await mapLimit(rows as any[], 2, async service => {
      try {
        const [loaderResult, bootstrapResult] = await Promise.all([
          runClaudium(buildLoader(origin, String(service.id)), "executor", true),
          runClaudium(buildPublicBootstrap(origin, String(service.id)), "executor", true)
        ]);

        if (!loaderResult.ok) {
          return {
            id: service.id,
            name: service.name,
            ok: false,
            error: loaderResult.error,
            detail: loaderResult.detail || null
          };
        }

        if (!bootstrapResult.ok) {
          return {
            id: service.id,
            name: service.name,
            ok: false,
            error: bootstrapResult.error,
            detail: bootstrapResult.detail || null
          };
        }

        await sql`
          UPDATE service_loaders
          SET loader_ciphertext = ${encryptConfig({ source: loaderResult.output })},
              bootstrap_ciphertext = ${encryptConfig({ source: bootstrapResult.output })},
              updated_at = now()
          WHERE service_id = ${service.id}
        `;

        return { id: service.id, name: service.name, ok: true };
      } catch (error) {
        return {
          id: service.id,
          name: service.name,
          ok: false,
          error: error instanceof Error ? error.message : "unknown_error"
        };
      }
    });

    return noStoreJson({
      ok: true,
      action,
      total: results.length,
      succeeded: results.filter((x: any) => x.ok).length,
      failed: results.filter((x: any) => !x.ok)
    });
  }

  return noStoreJson({ ok: false, error: "unknown_action" }, 400);
}
