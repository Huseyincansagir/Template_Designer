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

/**
 * UI Add Widget placement (S4-01). Core stores the geometry it is given; the
 * cascade that chooses that geometry lives inline in App.tsx so it is
 * specified here rather than extracted. Each new widget steps by
 * width+grid / height+grid from the scene-centre default, wrapping after 8.
 */
function cascadedAddWidgetGeometry(
  existingWidgetCount: number,
  rotation: { width: number; height: number },
  snapGridSize = 10,
  size = { width: 120, height: 80 },
) {
  const cascade = existingWidgetCount % 8;
  const stepX = size.width + snapGridSize;
  const stepY = size.height + snapGridSize;
  const x = Math.max(0, Math.round((((rotation.width - size.width) / 2) + cascade * stepX) / snapGridSize) * snapGridSize);
  const y = Math.max(0, Math.round((((rotation.height - size.height) / 2) + cascade * stepY) / snapGridSize) * snapGridSize);
  return { x, y, width: size.width, height: size.height };
}

describe("Widget add cascade (S4-01)", () => {
  const rotation = { width: 720, height: 1280 };
  const grid = 10;
  const size = { width: 120, height: 80 };

  it("places the first widget at the documented scene-centre default", () => {
    const first = cascadedAddWidgetGeometry(0, rotation, grid, size);
    expect(first).toEqual({ x: 300, y: 600, width: 120, height: 80 });
    expect(first.x).toBe(((rotation.width - size.width) / 2));
    expect(first.y).toBe(((rotation.height - size.height) / 2));
  });

  it("places the first widget at the origin when the scene-centre default is origin", () => {
    expect(cascadedAddWidgetGeometry(0, { width: 120, height: 80 }, grid, size)).toEqual({
      x: 0,
      y: 0,
      width: 120,
      height: 80,
    });
  });

  it("offsets the second widget by width+grid on X and height+grid on Y", () => {
    const first = cascadedAddWidgetGeometry(0, rotation, grid, size);
    const second = cascadedAddWidgetGeometry(1, rotation, grid, size);
    expect(second.x).toBe(first.x + size.width + grid);
    expect(second.y).toBe(first.y + size.height + grid);
    expect(second).toEqual({ x: 430, y: 690, width: 120, height: 80 });
  });

  it("does not stack identically on the previous widget", () => {
    const first = cascadedAddWidgetGeometry(0, rotation, grid, size);
    const second = cascadedAddWidgetGeometry(1, rotation, grid, size);
    expect(second).not.toEqual(first);
    expect({ x: second.x, y: second.y }).not.toEqual({ x: first.x, y: first.y });
  });

  it("wraps the cascade after eight widgets instead of stacking every add at one origin", () => {
    const positions = Array.from({ length: 8 }, (_, index) => cascadedAddWidgetGeometry(index, rotation, grid, size));
    const unique = new Set(positions.map((geometry) => `${geometry.x},${geometry.y}`));
    expect(unique.size).toBe(8);
    expect(cascadedAddWidgetGeometry(8, rotation, grid, size)).toEqual(positions[0]);
  });

  it("persists cascaded geometries through addWidget so successive widgets stay selectable", () => {
    const { project, sceneId } = projectWithScene();
    const { store, editor } = setup(project);
    const first = cascadedAddWidgetGeometry(1, rotation, grid, size);
    const second = cascadedAddWidgetGeometry(2, rotation, grid, size);
    expect(editor.addWidget(sceneId, "text", first).changed).toBe(true);
    expect(editor.addWidget(sceneId, "digit", second).changed).toBe(true);
    const widgets = store.getCurrent()?.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets ?? [];
    expect(widgets[1]?.geometry).toEqual(first);
    expect(widgets[2]?.geometry).toEqual(second);
    expect(widgets[2]?.geometry).not.toEqual(widgets[1]?.geometry);
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

describe("Clipboard paste (clipboard capability remediation)", () => {
  it("inserts fresh copies with re-parented bindings at the top of the target z-order", () => {
    const { project, sceneId } = projectWithScene();
    const { store, editor } = setup(project);
    const template = store.getCurrent()?.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[0];
    expect(template).toBeDefined();
    const result = editor.insertWidgetCopies(sceneId, [template!]);
    expect(result.changed).toBe(true);
    expect(result.createdIds).toHaveLength(1);
    const widgets = store.getCurrent()?.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets ?? [];
    expect(widgets).toHaveLength(2);
    const copy = widgets[1];
    expect(copy.id).toBe(result.createdIds?.[0]);
    expect(copy.bindings[0]?.widgetId).toBe(copy.id);
    expect(copy.zIndex).toBe(6); // above the existing max (5)
    expect(store.undo()).toBe(true);
    expect(store.getCurrent()?.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets).toHaveLength(1);
  });

  it("rejects paste into missing scenes and malformed templates without history", () => {
    const { project, sceneId } = projectWithScene();
    const { store, editor } = setup(project);
    const template = store.getCurrent()?.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[0]!;
    expect(editor.insertWidgetCopies("missing-scene", [template]).changed).toBe(false);
    expect(editor.insertWidgetCopies(sceneId, []).changed).toBe(false);
    expect(editor.insertWidgetCopies(sceneId, [{ ...template, geometry: { x: 0, y: 0, width: -1, height: 10 } }]).changed).toBe(false);
    expect(store.getSnapshot().history.undoCount).toBe(0);
    expect(store.getCurrent()).toEqual(project);
  });
});

describe("Phase 5 command surfaces", () => {
  it("renames any canonical node without touching stable ids", () => {
    const { project, sceneId } = projectWithScene();
    const { store, editor } = setup(project);
    expect(editor.renameNode(sceneId, "Renamed Scene").changed).toBe(true);
    expect(editor.renameNode("w1", "Renamed Widget").changed).toBe(true);
    expect(editor.renameNode("w1", "   ").changed).toBe(false);
    const after = store.getCurrent()!;
    const scene = after.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0];
    expect(scene.name).toBe("Renamed Scene");
    expect(scene.widgets[0]).toMatchObject({ id: "w1", name: "Renamed Widget" });
    expect(store.undo()).toBe(true);
    expect(store.getCurrent()?.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[0].name).toBe("w1");
  });

  it("edits Scene properties with priority validation", () => {
    const { project, sceneId } = projectWithScene();
    const { store, editor } = setup(project);
    expect(editor.setSceneProperties(sceneId, { priority: 7, enabled: false }).changed).toBe(true);
    expect(editor.setSceneProperties(sceneId, { priority: 11 }).changed).toBe(false);
    expect(editor.setSceneProperties(sceneId, { priority: 1.5 }).changed).toBe(false);
    expect(editor.setSceneProperties(sceneId, { name: "  " }).changed).toBe(false);
    const scene = store.getCurrent()?.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0];
    expect(scene).toMatchObject({ priority: 7, enabled: false });
    expect(store.undo()).toBe(true);
    expect(store.getCurrent()?.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0]).toMatchObject({ priority: 0 });
  });

  it("toggles visibility and lock in bulk without touching geometry", () => {
    const { project, sceneId } = projectWithScene();
    const { store, editor } = setup(project);
    const beforeGeometry = store.getCurrent()?.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[0].geometry;
    expect(editor.setWidgetsVisibilityInScene(sceneId, ["w1"], false).changed).toBe(true);
    expect(editor.setWidgetsPropertiesInScene(sceneId, ["w1"], { locked: true, zIndex: 42 }).changed).toBe(true);
    const widget = store.getCurrent()?.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[0];
    expect(widget).toMatchObject({ visible: false, locked: true, zIndex: 42, geometry: beforeGeometry });
    expect(editor.setWidgetsPropertiesInScene(sceneId, ["w1"], { zIndex: Number.NaN }).changed).toBe(false);
    expect(editor.setWidgetsVisibilityInScene("wrong-scene", ["w1"], true).changed).toBe(false);
    expect(store.undo()).toBe(true);
  });

  it("places duplicate-mode copies centered at the click point in one command", () => {
    const { project, sceneId } = projectWithScene();
    const { store, editor } = setup(project);
    // w1 bounds: x=10..110, y=10..50 → center (60, 30).
    const result = editor.duplicateWidgetsAt(sceneId, ["w1"], { x: 160, y: 130 });
    expect(result.changed).toBe(true);
    const copy = store.getCurrent()?.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[1];
    expect(copy?.geometry).toEqual({ x: 110, y: 110, width: 100, height: 40 });
    expect(copy?.bindings[0]?.widgetId).toBe(copy?.id);
    expect(store.getSnapshot().history.undoCount).toBe(1);
    expect(store.undo()).toBe(true);
  });

  it("replaces widget bindings atomically with validation", () => {
    const { project, sceneId } = projectWithScene();
    const { store, editor } = setup(project);
    const binding: Binding = {
      id: "b2",
      widgetId: "w1",
      conditions: [{ stateId: "fire", operator: "equals", value: false }],
      action: "hide",
    };
    expect(editor.replaceWidgetBindings(sceneId, "w1", [binding]).changed).toBe(true);
    expect(editor.replaceWidgetBindings(sceneId, "w1", [{ ...binding, conditions: [] }]).changed).toBe(false);
    expect(editor.replaceWidgetBindings(sceneId, "w1", [{ ...binding, widgetId: "w2" }]).changed).toBe(false);
    const bindings = store.getCurrent()?.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[0].bindings;
    expect(bindings).toHaveLength(1);
    expect(bindings?.[0].action).toBe("hide");
    expect(store.undo()).toBe(true);
  });

  it("switches the project Device Profile undoably", () => {
    const { project } = projectWithScene();
    const { store, editor } = setup(project);
    expect(editor.setProjectDeviceProfile("another-profile").changed).toBe(true);
    expect(store.getCurrent()?.deviceProfileId).toBe("another-profile");
    expect(store.undo()).toBe(true);
    expect(store.getCurrent()?.deviceProfileId).toBe("foundation-profile");
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
