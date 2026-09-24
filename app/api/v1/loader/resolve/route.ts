import { noStoreJson } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return noStoreJson({
    ok: false,
    error: "deprecated_endpoint",
    detail: "Use the one-time /api/v1/loader/fetch flow."
  }, 410);
}
