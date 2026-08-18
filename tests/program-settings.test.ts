import { describe, expect, it } from "vitest";
import { LocalStorageProgramSettings, defaultProgramSettings, PROGRAM_SETTINGS_STORAGE_KEY } from "../src/Infrastructure/program-settings-storage";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

describe("Program settings persistence (INT-13 remediation)", () => {
  it("round-trips settings through storage", () => {
    const backing = new MemoryStorage();
    const storage = new LocalStorageProgramSettings(backing);
    expect(storage.load()).toEqual(defaultProgramSettings);
    const next = { compactDensity: false, showGrid: false, confirmDestructive: false, snapGridSize: 20 };
    storage.save(next);
    expect(backing.getItem(PROGRAM_SETTINGS_STORAGE_KEY)).not.toBeNull();
    expect(new LocalStorageProgramSettings(backing).load()).toEqual(next);
  });

  it("falls back to defaults on corrupt or invalid payloads", () => {
    const backing = new MemoryStorage();
    const storage = new LocalStorageProgramSettings(backing);
    backing.setItem(PROGRAM_SETTINGS_STORAGE_KEY, "{broken");
    expect(storage.load()).toEqual(defaultProgramSettings);
    backing.setItem(PROGRAM_SETTINGS_STORAGE_KEY, JSON.stringify({ snapGridSize: -5, compactDensity: "yes" }));
    expect(storage.load()).toEqual(defaultProgramSettings);
  });

  it("clears persisted settings on demand", () => {
    const backing = new MemoryStorage();
    const storage = new LocalStorageProgramSettings(backing);
    storage.save({ ...defaultProgramSettings, snapGridSize: 15 });
    expect(backing.getItem(PROGRAM_SETTINGS_STORAGE_KEY)).not.toBeNull();
    storage.clear();
    expect(storage.load()).toEqual(defaultProgramSettings);
  });
});
