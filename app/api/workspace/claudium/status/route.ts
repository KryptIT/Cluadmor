import { claudiumConfigured } from "@/lib/claudium";
import { noStoreJson } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  return noStoreJson({
    ok: true,
    configured: claudiumConfigured(),
    ownerBypass: identity.bypassRewards
  });
}
