import { noStoreJson } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return noStoreJson({
    ok: false,
    error: "password_auth_disabled",
    detail: "Use Google or Discord OAuth."
  }, 410);
}
