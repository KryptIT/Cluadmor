import { accountFromRequest } from "@/lib/account";
import { isAccountBlacklisted } from "@/lib/blacklist";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { ownerFromRequest } from "@/lib/owner";

export type WorkspaceIdentity = {
  userId: string;
  bypassRewards: boolean;
  owner: boolean;
};

export async function workspaceIdentity(req: Request): Promise<WorkspaceIdentity | null> {
  await ensureWorkspaceSchema();

  const account = accountFromRequest(req);
  if (!account) return null;

  if (await isAccountBlacklisted(account.userId)) {
    return null;
  }

  const owner = ownerFromRequest(req);

  return {
    userId: account.userId,
    bypassRewards: owner,
    owner
  };
}
