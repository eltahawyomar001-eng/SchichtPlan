/** Erweiterter Session-User mit Workspace- und Rollen-Feldern. */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  workspaceId: string;
  workspaceName?: string | null;
}
