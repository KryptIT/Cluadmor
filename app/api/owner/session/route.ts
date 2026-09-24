import { clearOwnerCookie, issueOwnerToken, ownerCookie, ownerFromRequest, ownerKeyConfigured, verifyOwnerKey } from "@/lib/owner";
import { noStoreJson } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return noStoreJson({
    ok: true,
    owner: ownerFromRequest(req),
    configured: ownerKeyConfigured()
  });
}

export async function POST(req: Request) {
  let body: { ownerKey?: string };
  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  if (!ownerKeyConfigured()) {
    return noStoreJson({ ok: false, error: "owner_key_not_configured" }, 503);
  }

  if (!body.ownerKey || !verifyOwnerKey(body.ownerKey)) {
    return noStoreJson({ ok: false, error: "invalid_owner_key" }, 401);
  }

  const response = noStoreJson({ ok: true, owner: true });
  response.headers.append("Set-Cookie", ownerCookie(issueOwnerToken()));
  return response;
}

export async function DELETE() {
  const response = noStoreJson({ ok: true });
  response.headers.append("Set-Cookie", clearOwnerCookie());
  return response;
}
