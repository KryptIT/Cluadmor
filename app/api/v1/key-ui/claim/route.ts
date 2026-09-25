import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { digest, opaque } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  return value.replace(/[&<>"']/g, ch => entities[ch] || ch);
}

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{margin:0;background:#07090b;color:#e9f2f4;font:14px system-ui;display:grid;place-items:center;min-height:100vh}
.card{width:min(560px,calc(100vw - 40px));box-sizing:border-box;padding:28px;border:1px solid #17414a;border-radius:14px;background:#0b1013}
h1{font-size:20px;margin:0 0 8px}.muted{color:#8ea3a8;line-height:1.5}.key{margin:20px 0;padding:14px;border-radius:9px;background:#05090b;border:1px solid #18343a;font:13px ui-monospace,monospace;word-break:break-all}
button{width:100%;padding:12px;border:0;border-radius:8px;background:#176d7c;color:white;font-weight:700;cursor:pointer}
</style>
</head>
<body><div class="card">${body}</div></body>
</html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "Pragma": "no-cache",
        "X-Robots-Tag": "noindex, nofollow, noarchive"
      }
    }
  );
}

export async function GET(req: Request) {
  await ensureWorkspaceSchema();

  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token) {
    return page("Claudmor", "<h1>Invalid key session</h1><p class=\"muted\">The key session is missing.</p>", 400);
  }

  const tokenHash = digest("provider-key:" + token);
  const activationKey = opaque("CLM", 24);
  const activationHash = digest(activationKey);

  const sessions = await sql`
    UPDATE provider_key_sessions
    SET consumed_at = now(),
        activation_hash = ${activationHash},
        expires_at = now() + interval '60 minutes'
    WHERE token_hash = ${tokenHash}
      AND consumed_at IS NULL
      AND expires_at > now()
    RETURNING service_id
  `;

  const session = sessions[0] as any;
  if (!session) {
    return page(
      "Claudmor",
      "<h1>Key link expired</h1><p class=\"muted\">This key link was already used or expired. Generate a new one from the script.</p>",
      410
    );
  }

  const services = await sql`
    SELECT name, enabled, key_system_enabled
    FROM services
    WHERE id = ${session.service_id}
    LIMIT 1
  `;

  const service = services[0] as any;
  if (!service || !service.enabled || !service.key_system_enabled) {
    return page("Claudmor", "<h1>Service unavailable</h1><p class=\"muted\">This service is not accepting keys.</p>", 403);
  }

  const safeKey = escapeHtml(activationKey);
  const safeName = escapeHtml(String(service.name || "Claudmor"));

  return page(
    safeName + " key",
    `<h1>${safeName}</h1>
<p class="muted">Your activation key is ready. It is not activated yet. The first time you run the loader with it, Claudmor creates the real license and locks it to that executor's HWID, Roblox username, and Roblox UserId.</p>
<div class="key" id="key">${safeKey}</div>
<button onclick="navigator.clipboard.writeText(document.getElementById('key').textContent).then(()=>this.textContent='Copied!')">Copy key</button>
<p class="muted" style="margin-top:14px">Activate it within 60 minutes. The normal key lifetime starts on first execution.</p>`
  );
}
