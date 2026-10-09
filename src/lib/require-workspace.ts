/**
 * Turn a possibly-absent workspace into a refusal, never into a missing filter.
 *
 * Several routes authenticate with getServerSession and then query with
 * `where: { id, workspaceId: workspaceId ?? undefined }`. Prisma drops an
 * `undefined` key, so for an account with no workspace that `where` collapses
 * to `{ id }` -- a lookup by primary key across every tenant in the database.
 * A user can lose their workspace legitimately: removal from a team detaches
 * them while leaving the account intact.
 *
 * The danger is that the broken version reads as defensive. `?? undefined`
 * looks like it is handling the null case, and it is: by removing the only
 * thing that scopes the query.
 *
 * requireAuth already refuses a workspaceless session, so routes built on it
 * never needed this. These routes do.
 */
import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/types";

export type WorkspaceGuard =
  | { ok: true; workspaceId: string }
  | { ok: false; response: NextResponse };

export function requireSessionWorkspace(user: SessionUser): WorkspaceGuard {
  const workspaceId = user.workspaceId;
  if (!workspaceId) {
    // 403, not 401: the caller is who they say they are, they simply belong to
    // no workspace. Re-authenticating would not help, and saying "unauthorized"
    // would send them round a login loop.
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "NO_WORKSPACE",
          message:
            "Ihr Konto gehört zu keinem Arbeitsbereich. Bitte wenden Sie sich an Ihre Administration.",
          messageEn:
            "Your account does not belong to a workspace. Please contact your administrator.",
        },
        { status: 403 },
      ),
    };
  }
  return { ok: true, workspaceId };
}
