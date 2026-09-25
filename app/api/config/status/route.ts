import { noStoreJson } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function present(value: string | undefined) {
  return !!String(value || "").trim();
}

export async function GET() {
  return noStoreJson({
    ok: true,
    googleOAuth:
      present(process.env.GOOGLE_CLIENT_ID) &&
      present(process.env.GOOGLE_CLIENT_SECRET),
    discordOAuth:
      present(process.env.DISCORD_CLIENT_ID) &&
      present(process.env.DISCORD_CLIENT_SECRET),
    claudiumApi:
      present(process.env.CLAUDIUM_INTERNAL_URL) &&
      present(process.env.CLAUDIUM_INTERNAL_SECRET),
    ownerAccess: present(process.env.CLAUDMOR_OWNER_KEY)
  });
}
