import type { RotationAngle } from "../Domain/models";

/**
 * Workspace session state: which Theme / Rotation / Scene the designer was
 * looking at, and the viewing controls around it. This is NOT part of the
 * canonical project document — it never enters the deployment package — but
 * losing it on every reload made the editor forget the designer's context
 * completely (D3-06).
 *
 * It is keyed by project id, so restoring a different project never applies a
 * stale navigation position.
 */
export type WorkspaceSession = {
  readonly projectId: string;
  readonly activeThemeId: string | null;
  readonly activeRotationAngle: RotationAngle;
  readonly activeSceneId: string | null;
  readonly zoom: number;
  readonly leftDockTab: "explorer" | "assets";
  readonly rightDockTab: "properties" | "simulator";
  readonly expandedNodeIds: readonly string[];
};

export const WORKSPACE_SESSION_STORAGE_KEY = "template-designer.session.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isRotationAngle(value: unknown): value is RotationAngle {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

function isWorkspaceSession(value: unknown): value is WorkspaceSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.projectId === "string"
    && (candidate.activeThemeId === null || typeof candidate.activeThemeId === "string")
    && (candidate.activeSceneId === null || typeof candidate.activeSceneId === "string")
    && isRotationAngle(candidate.activeRotationAngle)
    && typeof candidate.zoom === "number"
    && Number.isFinite(candidate.zoom)
    && (candidate.leftDockTab === "explorer" || candidate.leftDockTab === "assets")
    && (candidate.rightDockTab === "properties" || candidate.rightDockTab === "simulator")
    && Array.isArray(candidate.expandedNodeIds)
    && candidate.expandedNodeIds.every((id) => typeof id === "string");
}

export class LocalStorageWorkspaceSession {
  constructor(private readonly storage: StorageLike) {}

  /** Returns the session only when it belongs to the given project. */
  load(projectId: string): WorkspaceSession | undefined {
    try {
      const raw = this.storage.getItem(WORKSPACE_SESSION_STORAGE_KEY);
      if (!raw) return undefined;
      const parsed: unknown = JSON.parse(raw);
      if (!isWorkspaceSession(parsed) || parsed.projectId !== projectId) return undefined;
      return parsed;
    } catch {
      return undefined;
    }
  }

  save(session: WorkspaceSession): void {
    try {
      this.storage.setItem(WORKSPACE_SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // A full or unavailable storage must never break editing.
    }
  }

  clear(): void {
    try {
      this.storage.removeItem(WORKSPACE_SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
