export type ProgramSettings = {
  compactDensity: boolean;
  showGrid: boolean;
  confirmDestructive: boolean;
  snapGridSize: number;
  /** Restore the last Theme/Rotation/Scene, zoom and panel tabs on reload. */
  restoreSession: boolean;
};

export const PROGRAM_SETTINGS_STORAGE_KEY = "template-designer.settings.v1";

export const defaultProgramSettings: ProgramSettings = {
  compactDensity: true,
  showGrid: true,
  confirmDestructive: true,
  snapGridSize: 10,
  restoreSession: true,
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type PartialSettings = Partial<Record<keyof ProgramSettings, unknown>>;

/**
 * Shape gate for the settings record. Only the long-standing fields are
 * required; a field added later is normalized to its default so a settings
 * file written by an older build is upgraded instead of discarded.
 */
function isProgramSettings(value: unknown): value is PartialSettings {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.compactDensity === "boolean"
    && typeof candidate.showGrid === "boolean"
    && typeof candidate.confirmDestructive === "boolean"
    && typeof candidate.snapGridSize === "number"
    && Number.isFinite(candidate.snapGridSize)
    && candidate.snapGridSize > 0
  );
}

function normalize(candidate: PartialSettings): ProgramSettings {
  return {
    compactDensity: candidate.compactDensity as boolean,
    showGrid: candidate.showGrid as boolean,
    confirmDestructive: candidate.confirmDestructive as boolean,
    snapGridSize: candidate.snapGridSize as number,
    restoreSession: typeof candidate.restoreSession === "boolean" ? candidate.restoreSession : defaultProgramSettings.restoreSession,
  };
}

/**
 * Browser-build persistence for Program Settings. The Tauri build can
 * substitute a filesystem-backed adapter behind the same interface.
 */
export class LocalStorageProgramSettings {
  constructor(private readonly storage: StorageLike) {}

  load(): ProgramSettings {
    try {
      const raw = this.storage.getItem(PROGRAM_SETTINGS_STORAGE_KEY);
      if (!raw) return { ...defaultProgramSettings };
      const parsed: unknown = JSON.parse(raw);
      return isProgramSettings(parsed) ? normalize(parsed) : { ...defaultProgramSettings };
    } catch {
      return { ...defaultProgramSettings };
    }
  }

  save(settings: ProgramSettings): void {
    this.storage.setItem(PROGRAM_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }

  clear(): void {
    this.storage.removeItem(PROGRAM_SETTINGS_STORAGE_KEY);
  }
}
