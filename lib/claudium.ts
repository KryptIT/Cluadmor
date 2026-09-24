export type ClaudiumResult =
  | { ok: true; output: string; raw: string }
  | { ok: false; status: number; error: string; detail?: string };

function endpoint() {
  const raw = (process.env.CLAUDIUM_INTERNAL_URL || "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
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

export async function runClaudium(source: string, preset = "executor"): Promise<ClaudiumResult> {
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
        antiTamper: true
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
