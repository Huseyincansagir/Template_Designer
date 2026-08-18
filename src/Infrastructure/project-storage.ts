import type { Project } from "../Domain/models";

/**
 * Platform-neutral project persistence boundary. The UI never touches
 * storage APIs directly; the DocumentStore delegates Save/Open through this
 * adapter (AGENTS.md: UI → Application Service → Platform Adapter).
 */
export interface ProjectStorage {
  save(project: Project): void;
  load(): Project | null;
  clear(): void;
}

export const PROJECT_STORAGE_KEY = "template-designer.project.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isLoadableProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string"
    && typeof candidate.name === "string"
    && typeof candidate.schemaVersion === "number"
    && typeof candidate.deviceProfileId === "string"
    && Array.isArray(candidate.themeProjectGroups)
    && Array.isArray(candidate.assets)
  );
}

/**
 * Browser-build persistence: serializes the canonical Project to
 * `localStorage`. The Tauri desktop build can substitute a filesystem-backed
 * adapter behind the same interface.
 */
export class LocalStorageProjectStorage implements ProjectStorage {
  constructor(private readonly storage: StorageLike) {}

  save(project: Project): void {
    this.storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  }

  load(): Project | null {
    try {
      const raw = this.storage.getItem(PROJECT_STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return isLoadableProject(parsed) ? parsed : null;
    } catch {
      // Corrupt or unavailable storage must never crash the editor boot.
      return null;
    }
  }

  clear(): void {
    this.storage.removeItem(PROJECT_STORAGE_KEY);
  }
}
