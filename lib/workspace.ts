import { accountFromRequest } from "@/lib/account";
import { ownerFromRequest } from "@/lib/owner";

export type WorkspaceIdentity = {
  userId: string;
  bypassRewards: boolean;
  owner: boolean;
};

export async function workspaceIdentity(req: Request): Promise<WorkspaceIdentity | null> {
  const account = accountFromRequest(req);
  if (!account) return null;

  const owner = ownerFromRequest(req);

  return {
    userId: account.userId,
    bypassRewards: owner,
    owner
  };
}
