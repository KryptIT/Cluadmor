import { GET as getKeyUi } from "@/app/ui/keysystem.lua/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return getKeyUi(req);
}
