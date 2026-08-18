import { describe, expect, it } from "vitest";
import { InMemoryDocumentStore } from "../src/Core/document-store";
import { CommandHistory } from "../src/Core/commands";
import { createEditorApplication } from "../src/Core/editor-application";
import { createEmptyProject } from "../src/Domain/factories";
import { LocalStorageProjectStorage, PROJECT_STORAGE_KEY } from "../src/Infrastructure/project-storage";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

function setup(storage: MemoryStorage) {
  const adapter = new LocalStorageProjectStorage(storage);
  const store = new InMemoryDocumentStore(new CommandHistory(), adapter);
  store.open(createEmptyProject("Persisted"));
  return { store, editor: createEditorApplication(store), adapter };
}

describe("Project persistence adapter (C-02 remediation)", () => {
  it("writes the project on save and restores it through load", () => {
    const backing = new MemoryStorage();
    const { store, editor, adapter } = setup(backing);
    expect(store.getSnapshot().isDirty).toBe(false);
    expect(editor.addThemeProject(store.getCurrent()!.themeProjectGroups[0].id, "Saved Theme").changed).toBe(true);
    expect(store.getSnapshot().isDirty).toBe(true);

    store.save();
    expect(store.getSnapshot().isDirty).toBe(false);
    expect(backing.getItem(PROJECT_STORAGE_KEY)).not.toBeNull();

    const restored = adapter.load();
    expect(restored?.name).toBe("Persisted");
    expect(restored?.themeProjectGroups[0].themeProjects).toHaveLength(2);

    const second = new InMemoryDocumentStore(new CommandHistory(), adapter);
    second.open(adapter.load() ?? createEmptyProject());
    expect(second.getSnapshot().isDirty).toBe(false);
    expect(second.getCurrent()).toEqual(store.getCurrent());
  });

  it("keeps the dirty flag when the storage write fails", () => {
    const failing = {
      getItem: () => null,
      setItem: () => { throw new Error("quota exceeded"); },
      removeItem: () => {},
    };
    const store = new InMemoryDocumentStore(new CommandHistory(), new LocalStorageProjectStorage(failing));
    store.open(createEmptyProject("Fragile"));
    const editor = createEditorApplication(store);
    expect(editor.addThemeProject(store.getCurrent()!.themeProjectGroups[0].id, "X").changed).toBe(true);
    expect(() => store.save()).toThrow("quota exceeded");
    expect(store.getSnapshot().isDirty).toBe(true);
  });

  it("treats corrupt or foreign payloads as absent", () => {
    const backing = new MemoryStorage();
    backing.setItem(PROJECT_STORAGE_KEY, "{not json");
    expect(new LocalStorageProjectStorage(backing).load()).toBeNull();
    backing.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ id: "x", name: "no shape" }));
    expect(new LocalStorageProjectStorage(backing).load()).toBeNull();
  });

  it("rejects structurally broken nested payloads instead of crashing the editor (S5-04)", () => {
    const backing = new MemoryStorage();
    const storage = new LocalStorageProjectStorage(backing);
    // Build a canonical project that actually contains a scene + widget.
    const { store, editor } = setup(backing);
    const project = store.getCurrent()!;
    const rotationId = project.themeProjectGroups[0].themeProjects[0].rotations[0].id;
    expect(editor.addScene(rotationId, "Scene A").changed).toBe(true);
    const sceneId = store.getCurrent()!.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].id;
    expect(editor.addWidget(sceneId, "media").changed).toBe(true);
    const scaffold = store.getCurrent()!;

    const missingGeometry = structuredClone(scaffold);
    const sceneA = missingGeometry.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0] as unknown as { widgets: unknown[] };
    sceneA.widgets.push({ id: "w-broken", name: "Broken", widgetType: "media" });

    const missingWidgets = structuredClone(scaffold);
    const sceneB = missingWidgets.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0] as unknown as { widgets?: unknown };
    sceneB.widgets = undefined;

    const badRotation = structuredClone(scaffold);
    const rotation = badRotation.themeProjectGroups[0].themeProjects[0].rotations[0] as unknown as { width: unknown };
    rotation.width = "720";

    for (const [name, crafted] of [["missing geometry", missingGeometry], ["missing widgets", missingWidgets], ["non-numeric dims", badRotation]] as const) {
      backing.setItem(PROJECT_STORAGE_KEY, JSON.stringify(crafted));
      expect(storage.load(), name).toBeNull();
    }

    backing.setItem(PROJECT_STORAGE_KEY, JSON.stringify(scaffold));
    expect(storage.load()?.name).toBe("Persisted");
    expect(storage.load()?.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets).toHaveLength(1);
  });

  it("clears the persisted project on demand", () => {
    const backing = new MemoryStorage();
    const { store, adapter } = setup(backing);
    store.save();
    expect(adapter.load()).not.toBeNull();
    adapter.clear();
    expect(adapter.load()).toBeNull();
  });
});
