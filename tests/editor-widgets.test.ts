import { describe, expect, it } from "vitest";
import { InMemoryDocumentStore } from "../src/Core/document-store";
import { CommandHistory } from "../src/Core/commands";
import { createEditorApplication } from "../src/Core/editor-application";
import { createEmptyProject, foundationDeviceProfile } from "../src/Domain/factories";
import type { Binding, Project, Widget } from "../src/Domain/models";

function boundWidget(id: string, bindingId: string): Widget {
  const binding: Binding = {
    id: bindingId,
    widgetId: id,
    conditions: [{ stateId: "fire", operator: "equals", value: true }],
    action: "show",
  };
  return {
    id,
    name: id,
    widgetType: "media",
    enabled: true,
    visible: true,
    locked: false,
    geometry: { x: 10, y: 10, width: 100, height: 40 },
    zIndex: 5,
    bindings: [binding],
    assetIds: [],
  };
}

function projectWithScene(): { project: Project; sceneId: string } {
  const base = createEmptyProject("Widget Fixture");
  const theme = base.themeProjectGroups[0].themeProjects[0];
  const rotation = theme.rotations[0];
  const sceneId = "scene-fixture";
  const project: Project = {
    ...base,
    themeProjectGroups: [{
      ...base.themeProjectGroups[0],
      themeProjects: [{ ...theme, rotations: [{ ...rotation, scenes: [{ id: sceneId, name: "Scene Fixture", widgets: [boundWidget("w1", "b1")], priority: 0, activationConditions: [] }] }] }],
    }],
  };
  return { project, sceneId };
}

function setup(project: Project) {
  const store = new InMemoryDocumentStore(new CommandHistory());
  store.open(project);
  return { store, editor: createEditorApplication(store) };
}

describe("Widget creation (C-01 remediation)", () => {
  it("adds a profile-typed widget to a Scene through one undoable command", () => {
    const { project, sceneId } = projectWithScene();
    const { store, editor } = setup(project);
    const before = structuredClone(project);
    const result = editor.addWidget(sceneId, "digit", { x: 40, y: 50, width: 60, height: 30 });
    expect(result.changed).toBe(true);
    expect(result.createdIds).toHaveLength(1);

    const after = store.getCurrent();
    const widgets = after?.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets;
    expect(widgets).toHaveLength(2);
    const added = widgets?.[1];
    expect(added).toMatchObject({
      id: result.createdIds?.[0],
      name: "Digit",
      widgetType: "digit",
      enabled: true,
      visible: true,
      locked: false,
      geometry: { x: 40, y: 50, width: 60, height: 30 },
      zIndex: 6, // top of the Scene z-order (existing max 5)
      bindings: [],
    });
    expect(store.undo()).toBe(true);
    expect(store.getCurrent()).toEqual(before);
    expect(store.redo()).toBe(true);
    expect(store.getCurrent()).toEqual(after);
  });

  it("rejects widget creation for missing scenes, empty types and malformed geometry without history", () => {
    const { project, sceneId } = projectWithScene();
    const { store, editor } = setup(project);
    expect(editor.addWidget("missing-scene", "digit").changed).toBe(false);
    expect(editor.addWidget(sceneId, "  ").changed).toBe(false);
    expect(editor.addWidget(sceneId, "digit", { x: 0, y: 0, width: -1, height: 10 }).changed).toBe(false);
    expect(editor.addWidget(sceneId, "digit", { x: 0, y: 0, width: 10, height: Number.NaN }).changed).toBe(false);
    expect(store.getCurrent()).toEqual(project);
    expect(store.getSnapshot().history.undoCount).toBe(0);
    expect(store.getSnapshot().isDirty).toBe(false);
  });

  it("applies a default geometry when none is supplied", () => {
    const { project, sceneId } = projectWithScene();
    const { store, editor } = setup(project);
    expect(editor.addWidget(sceneId, "text").changed).toBe(true);
    const added = store.getCurrent()?.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[1];
    expect(added?.geometry).toEqual({ x: 0, y: 0, width: 120, height: 80 });
  });
});

describe("Duplicate integrity (INT-56 remediation)", () => {
  it("re-parents bindings to the copy and returns stable copy ids", () => {
    const { project, sceneId } = projectWithScene();
    const { store, editor } = setup(project);
    const result = editor.duplicateSelectionInScene(sceneId, ["w1"]);
    expect(result.changed).toBe(true);
    expect(result.createdIds).toHaveLength(1);
    const widgets = store.getCurrent()?.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets ?? [];
    expect(widgets).toHaveLength(2);
    const copy = widgets[1];
    expect(copy.id).toBe(result.createdIds?.[0]);
    expect(copy.bindings).toHaveLength(1);
    expect(copy.bindings[0].widgetId).toBe(copy.id);
    expect(copy.bindings[0].id).not.toBe("b1");
    expect(copy.name).toBe("w1 Copy");
    expect(copy.geometry).toEqual({ x: 20, y: 20, width: 100, height: 40 });
    // Original keeps its own binding untouched.
    expect(widgets[0].bindings[0].widgetId).toBe("w1");
  });

  it("duplicates container selections with re-parented bindings and copy ids", () => {
    const { project, sceneId } = projectWithScene();
    const { store, editor } = setup(project);
    const result = editor.duplicateSelectionInScene(sceneId, ["w1"]);
    expect(result.changed).toBe(true);
    expect(store.undo()).toBe(true);
    expect(store.redo()).toBe(true);
    const widgets = store.getCurrent()?.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets ?? [];
    expect(widgets.map((widget) => widget.id)).toEqual(["w1", result.createdIds?.[0]]);
  });
});

describe("Foundation profile runtime registries (M-10/INT-61 remediation)", () => {
  it("ships profile-defined runtime states and settings", () => {
    expect(foundationDeviceProfile.runtimeStates.length).toBeGreaterThan(0);
    expect(foundationDeviceProfile.runtimeSettings.length).toBeGreaterThan(0);
    expect(foundationDeviceProfile.digitStyles).toContain(foundationDeviceProfile.defaultDigitStyleId);
    expect(foundationDeviceProfile.runtimeSettings[0]?.defaultValue).toBeDefined();
  });
});
