export type ClaudiumResult =
  | { ok: true; output: string; raw: string }
  | { ok: false; status: number; error: string; detail?: string };

function isInternalLoaderSource(source: string) {
  return (
    source.includes('local function envGet(key)') &&
    source.includes('local function envSet(key, value)') &&
    source.includes('/api/v1/auth') &&
    source.includes('/api/v1/bootstrap/ticket') &&
    source.includes('/api/v1/loader/fetch') &&
    source.includes('source = delivery.source') &&
    source.includes('scriptName = tostring(delivery.scriptName or "script")')
  );
}

function isRoutedUserScript(source: string) {
  return (
    source.includes('__CLAUDMOR_AUTHORIZED') &&
    source.includes('__CLAUDMOR_SERVICE') &&
    source.includes('unauthorized execution') &&
    source.includes('invalid service')
  );
}

function rawBaseUrl() {
  const raw = (process.env.CLAUDIUM_INTERNAL_URL || "").trim();
  if (!raw) return null;

  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function endpoint() {
  const base = rawBaseUrl();
  if (!base) return null;

  try {
    const url = new URL(base.toString());
    const path = url.pathname.replace(/\/+$/, "");
    if (!path || path === "") url.pathname = "/obfuscate";
    else if (path !== "/obfuscate") url.pathname = path + "/obfuscate";
    return url.toString();
  } catch {
    return null;
  }
}

export function claudiumConfigured() {
  return !!endpoint() && !!(process.env.CLAUDIUM_INTERNAL_SECRET || "").trim();
}

export async function claudiumHealth() {
  const base = rawBaseUrl();
  const configured = claudiumConfigured();

  if (!base || !configured) {
    return {
      configured,
      online: false,
      status: 0,
      detail: "Claudium URL/secret is not configured."
    };
  }

  const health = new URL(base.toString());
  health.pathname = "/health";
  health.search = "";

  try {
    const response = await fetch(health, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });

    const text = await response.text();

    return {
      configured: true,
      online: response.ok,
      status: response.status,
      detail: response.ok ? "online" : text.slice(0, 300)
    };
  } catch (error) {
    return {
      configured: true,
      online: false,
      status: 0,
      detail: error instanceof Error ? error.message : "Could not reach Claudium."
    };
  }
}

export async function runClaudium(source: string, preset = "executor", antiTamper = true): Promise<ClaudiumResult> {
  // Claudium's VM has repeatedly corrupted Roblox service/member access in the
  // internal runtime loader. Keep that small transport/auth loader readable;
  // user scripts still go through the normal obfuscation path. Retry deployment once more.
  if (isInternalLoaderSource(source)) {
    return { ok: true, output: source, raw: source };
  }

  const url = endpoint();
  const secret = (process.env.CLAUDIUM_INTERNAL_SECRET || "").trim();

  if (!url || !secret) {
    return { ok: false, status: 503, error: "obfuscator_unavailable", detail: "Claudium URL/secret is not configured." };
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret}`
      },
      body: JSON.stringify({
        source,
        preset: preset || "executor",
        // Claudium anti-tamper can hard-crash some Roblox executors when the
        // protected routed payload begins execution. Keep the script obfuscated,
        // but disable only anti-tamper for Claudmor-routed user scripts.
        antiTamper: isRoutedUserScript(source) ? false : antiTamper
      }),
      cache: "no-store"
    });

    const raw = await upstream.text();

    if (!upstream.ok) {
      let detail = raw.slice(0, 1000);
      try {
        const parsed = JSON.parse(raw);
        detail = parsed?.detail?.message || parsed?.detail || parsed?.error || detail;
        if (typeof detail !== "string") detail = JSON.stringify(detail);
      } catch {}

      return {
        ok: false,
        status: upstream.status,
        error: "obfuscation_failed",
        detail
      };
    }

    try {
      const parsed = JSON.parse(raw);
      const output = parsed?.output || parsed?.result;
      if (typeof output === "string" && output.length > 0) {
        return { ok: true, output, raw };
      }
    } catch {}

    if (raw.trim()) return { ok: true, output: raw, raw };

    return {
      ok: false,
      status: 502,
      error: "empty_obfuscator_output",
      detail: "Claudium returned an empty response."
    };
  } catch (error) {
    return {
      ok: false,
      status: 503,
      error: "obfuscator_unavailable",
      detail: error instanceof Error ? error.message : "Could not reach Claudium."
    };
  }
}
