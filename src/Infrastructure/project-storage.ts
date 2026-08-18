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

function isNumeric(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

/**
 * Deep load-time shape gate (S5-04): a project that parses as JSON but is
 * missing nested fields must NEVER be handed to the editor — it would crash
 * to the ErrorBoundary with no user recovery path. Anything below this bar
 * is treated as absent and the app boots to the canonical scaffold.
 */
function isLoadableProject(value: unknown): value is Project {
  if (!isRecord(value)) return false;
  const candidate = value;
  if (
    typeof candidate.id !== "string"
    || typeof candidate.name !== "string"
    || typeof candidate.schemaVersion !== "number"
    || typeof candidate.deviceProfileId !== "string"
    || !Array.isArray(candidate.themeProjectGroups)
    || !Array.isArray(candidate.assets)
  ) return false;
  for (const group of candidate.themeProjectGroups) {
    if (!isRecord(group) || typeof group.id !== "string" || !Array.isArray(group.themeProjects)) return false;
    for (const theme of group.themeProjects) {
      if (!isRecord(theme) || typeof theme.id !== "string" || !Array.isArray(theme.rotations)) return false;
      for (const rotation of theme.rotations) {
        if (!isRecord(rotation) || typeof rotation.id !== "string" || !isNumeric(rotation.width) || !isNumeric(rotation.height) || !Array.isArray(rotation.scenes)) return false;
        for (const scene of rotation.scenes) {
          if (!isRecord(scene) || typeof scene.id !== "string" || !Array.isArray(scene.widgets)) return false;
          for (const widget of scene.widgets) {
            if (!isRecord(widget) || typeof widget.id !== "string" || typeof widget.name !== "string" || typeof widget.widgetType !== "string") return false;
            const geometry = widget.geometry;
            if (!isRecord(geometry) || !isNumeric(geometry.x) || !isNumeric(geometry.y) || !isNumeric(geometry.width) || !isNumeric(geometry.height)) return false;
            if (!isNumeric(widget.zIndex) || !Array.isArray(widget.bindings)) return false;
          }
        }
      }
    }
  }
  return true;
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
