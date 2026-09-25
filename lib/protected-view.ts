export function looksLikeBrowserNavigation(req: Request) {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  const accept = (req.headers.get("accept") || "").toLowerCase();
  const mode = (req.headers.get("sec-fetch-mode") || "").toLowerCase();
  const dest = (req.headers.get("sec-fetch-dest") || "").toLowerCase();

  return accept.includes("text/html") || (
    ua.includes("mozilla/") && (mode === "navigate" || dest === "document")
  );
}

export function protectedHtml(kind: "loader" | "script" | "source" = "source") {
  const noun = kind === "loader" ? "loader" : kind === "script" ? "script" : "source";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow,noarchive"/>
<title>Protected by Claudmor</title>
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#060809;color:#e8eef1;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
body{min-height:100vh;display:grid;place-items:center;overflow:hidden}
body:before{content:"";position:fixed;inset:-30%;background:radial-gradient(circle at 50% 45%,rgba(68,170,190,.08),transparent 28%),linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px);background-size:auto,34px 34px,34px 34px;transform:rotate(-4deg)}
.wrap{position:relative;width:min(92vw,720px);padding:42px 34px;text-align:center}.mark{width:74px;height:74px;margin:0 auto 22px;display:grid;place-items:center;border:1px solid #18383f;border-radius:18px;background:#091114;box-shadow:0 0 50px rgba(64,190,211,.08)}.mark svg{width:35px;height:35px;stroke:#65d2df}.badge{display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid #1b343a;border-radius:999px;background:#091013;color:#6cbcc7;font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.13em;text-transform:uppercase}h1{margin:18px 0 10px;font-size:clamp(30px,5vw,50px);line-height:1.02;letter-spacing:-.04em}p{max-width:560px;margin:0 auto;color:#74838a;font-size:14px;line-height:1.7}.rule{width:54px;height:1px;margin:26px auto;background:#183139}.small{font:10px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;color:#425057}
</style>
</head>
<body>
<main class="wrap">
  <div class="mark"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4.8 6v5.3c0 4.5 2.7 8 7.2 9.7 4.5-1.7 7.2-5.2 7.2-9.7V6L12 3Z"/><path d="m9.4 12 1.7 1.7 3.7-4"/></svg></div>
  <span class="badge">Claudmor protected</span>
  <h1>Protected content.</h1>
  <p>This ${noun} is delivered only through an authorized Claudmor runtime. Browser viewing is blocked and no protected source is exposed here.</p>
  <div class="rule"></div>
  <div class="small">CLAUDMOR / SOURCE PROTECTION</div>
</main>
</body>
</html>`;
}

export function protectedBrowserResponse(req: Request, kind: "loader" | "script" | "source" = "source") {
  if (!looksLikeBrowserNavigation(req)) {
    return new Response("method_not_allowed", {
      status: 405,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }

  return new Response(protectedHtml(kind), {
    status: 403,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; frame-ancestors 'none'"
    }
  });
}
