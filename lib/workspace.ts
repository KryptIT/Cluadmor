import { sql } from "@/lib/db";
import { accountFromRequest } from "@/lib/account";
import { ownerFromRequest } from "@/lib/owner";

export type WorkspaceIdentity = {
  userId: string;
  bypassRewards: boolean;
  owner: boolean;
};

async function ownerUserId() {
  const rows = await sql`
    INSERT INTO users(username)
    VALUES ('__claudmor_owner__')
    ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
    RETURNING id
  `;
  return String((rows[0] as any).id);
}

export async function workspaceIdentity(req: Request): Promise<WorkspaceIdentity | null> {
  if (ownerFromRequest(req)) {
    return {
      userId: await ownerUserId(),
      bypassRewards: true,
      owner: true
    };
  }

  const account = accountFromRequest(req);
  if (!account) return null;

  return {
    userId: account.userId,
    bypassRewards: false,
    owner: false
  };
}
