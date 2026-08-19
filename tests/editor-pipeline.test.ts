import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "../src/App/App";
import { createDeviceProfileRegistry } from "../src/App/profile-registry";
import { createEmptyProject, foundationDeviceProfile } from "../src/Domain/factories";
import type { Project, Scene, ThemeProject, Widget } from "../src/Domain/models";
import { CommandHistory } from "../src/Core/commands";
import { createEditorApplication } from "../src/Core/editor-application";
import { InMemoryDocumentStore } from "../src/Core/document-store";

function widget(id: string, x = 0): Widget {
  return {
    id,
    name: id,
    widgetType: "text",
    enabled: true,
    visible: true,
    locked: false,
    geometry: { x, y: 10, width: 100, height: 40 },
    zIndex: x,
    bindings: [],
    content: { text: id },
  };
}

function hierarchyProject(): { project: Project; groupId: string; themeId: string; rotationId: string; sceneId: string } {
  const scene: Scene = {
    id: "scene-1",
    name: "Scene 1",
    widgets: [widget("w1", 10), widget("w2", 20), widget("w3", 30)],
    priority: 0,
    activationConditions: [],
  };
  const theme: ThemeProject = {
    id: "theme-1",
    name: "Theme 1",
    rotations: [{ id: "rotation-1", angle: 0, width: 720, height: 1280, scenes: [scene] }],
    resources: [],
  };
  const base = createEmptyProject("Fixture Project");
  const project: Project = {
    ...base,
    themeProjectGroups: [{ ...base.themeProjectGroups[0], themeProjects: [theme] }],
  };
  return { project, groupId: project.themeProjectGroups[0].id, themeId: theme.id, rotationId: "rotation-1", sceneId: scene.id };
}

function setup(project = createEmptyProject()): { store: InMemoryDocumentStore; editor: ReturnType<typeof createEditorApplication> } {
  const store = new InMemoryDocumentStore();
  store.open(project);
  return { store, editor: createEditorApplication(store) };
}

function current(store: InMemoryDocumentStore): Project {
  const project = store.getCurrent();
  if (!project) throw new Error("Expected an open project");
  return project;
}

describe("canonical editor mutation pipeline remediation", () => {
  it("keeps a cached snapshot and renders the application surface", () => {
    const { store } = setup();
    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);
    const registry = createDeviceProfileRegistry([foundationDeviceProfile]);
    const html = renderToString(createElement(App, { profileRegistry: registry }));
    expect(html).toContain("Template Designer");
  });

  it("adds a Theme Project with exact undo/redo transitions", () => {
    const { store, editor } = setup();
    const before = structuredClone(current(store));
    const result = editor.addThemeProject(before.themeProjectGroups[0].id, "Theme A");
    expect(result.changed).toBe(true);
    const after = structuredClone(current(store));
    expect(after.themeProjectGroups[0].themeProjects).toHaveLength(2);
    expect(after.themeProjectGroups[0].themeProjects[0]).toMatchObject({ name: "New Theme Project" });
    expect(after.themeProjectGroups[0].themeProjects[1]).toMatchObject({ name: "Theme A", resources: [] });
    expect(after.themeProjectGroups[0].themeProjects[1].rotations.map((rotation) => rotation.angle)).toEqual([0, 90, 180, 270]);
    expect(after.themeProjectGroups[0].themeProjects[1].id).not.toBe(after.themeProjectGroups[0].themeProjects[0].id);
    expect(store.undo()).toBe(true);
    expect(current(store)).toEqual(before);
    expect(store.redo()).toBe(true);
    expect(current(store)).toEqual(after);
  });

  it("creates menu-added Theme Projects with the canonical four rotations (S2-05)", () => {
    const { store, editor } = setup();
    const groupId = current(store).themeProjectGroups[0].id;
    expect(editor.addThemeProject(groupId, "Theme B", foundationDeviceProfile.display).changed).toBe(true);
    const added = current(store).themeProjectGroups[0].themeProjects[1];
    expect(added.rotations.map((rotation) => rotation.angle)).toEqual([0, 90, 180, 270]);
    expect(added.rotations[0]).toMatchObject({ width: 720, height: 1280 });
    expect(added.rotations[1]).toMatchObject({ width: 1280, height: 720 });
    expect(added.rotations.every((rotation) => rotation.scenes.length === 0)).toBe(true);
    expect(store.undo()).toBe(true);
    expect(current(store).themeProjectGroups[0].themeProjects).toHaveLength(1);
  });

  it("infers the four rotations from a sibling R0 when display is omitted", () => {
    const { project, groupId } = hierarchyProject();
    const { store, editor } = setup(project);
    expect(project.themeProjectGroups[0].themeProjects[0].rotations.map((rotation) => rotation.angle)).toEqual([0]);
    expect(editor.addThemeProject(groupId, "Inferred").changed).toBe(true);
    const added = current(store).themeProjectGroups[0].themeProjects.find((theme) => theme.name === "Inferred");
    expect(added?.rotations.map((rotation) => rotation.angle)).toEqual([0, 90, 180, 270]);
    expect(added?.rotations[0]).toMatchObject({ width: 720, height: 1280 });
    expect(added?.rotations[1]).toMatchObject({ width: 1280, height: 720 });
    expect(added?.rotations[2]).toMatchObject({ width: 720, height: 1280 });
    expect(added?.rotations[3]).toMatchObject({ width: 1280, height: 720 });
    expect(added?.rotations.every((rotation) => rotation.scenes.length === 0)).toBe(true);
  });

  it("refuses Add Theme Project when no display and no sibling R0 exist", () => {
    const empty = createEmptyProject();
    const project: Project = {
      ...empty,
      themeProjectGroups: [{ ...empty.themeProjectGroups[0], themeProjects: [] }],
    };
    const { store, editor } = setup(project);
    expect(editor.addThemeProject(project.themeProjectGroups[0].id, "Dead").changed).toBe(false);
    expect(current(store).themeProjectGroups[0].themeProjects).toEqual([]);
    expect(store.getSnapshot().history.undoCount).toBe(0);
  });

  it("refuses to delete or duplicate a Rotation so the canonical four always survive", () => {
    const { project, rotationId } = hierarchyProject();
    const { store, editor } = setup(project);
    const before = structuredClone(current(store));
    // There is deliberately no Add Rotation command, so a Rotation delete or
    // duplicate would leave a structurally invalid Theme Project the UI could
    // never repair.
    expect(editor.deleteSelection([rotationId]).changed).toBe(false);
    expect(editor.duplicateSelection([rotationId]).changed).toBe(false);
    expect(current(store)).toEqual(before);
    expect(store.getSnapshot().history.undoCount).toBe(0);
    expect("addRotation" in editor).toBe(false);
  });

  it("adds a Scene as a real Scene object and preserves its hierarchy", () => {
    const { project, rotationId } = hierarchyProject();
    const { store, editor } = setup(project);
    const before = structuredClone(current(store));
    expect(editor.addScene(rotationId, "Scene 2").changed).toBe(true);
    const after = structuredClone(current(store));
    const rotation = after.themeProjectGroups[0].themeProjects[0].rotations[0];
    expect(rotation.scenes.map((scene) => scene.name)).toEqual(["Scene 1", "Scene 2"]);
    expect(rotation.scenes.every((scene) => Array.isArray(scene.widgets) && Array.isArray(scene.activationConditions))).toBe(true);
    expect(rotation.scenes[1]).toMatchObject({ name: "Scene 2", priority: 0, widgets: [], activationConditions: [] });
    expect(new Set(rotation.scenes.map((scene) => scene.id)).size).toBe(2);
    expect(store.undo()).toBe(true);
    expect(current(store)).toEqual(before);
    expect(store.redo()).toBe(true);
    expect(current(store)).toEqual(after);
    expect(current(store).themeProjectGroups[0].themeProjects[0].rotations[0].scenes.every((scene) => Array.isArray(scene.widgets))).toBe(true);
  });

  it("moves only the requested Scene and preserves every nested Widget", () => {
    const { project, rotationId } = hierarchyProject();
    const scenes: Scene[] = [
      { id: "scene-1", name: "Scene 1", widgets: [widget("s1-w1")], priority: 0, activationConditions: [] },
      { id: "scene-2", name: "Scene 2", widgets: [widget("s2-w1")], priority: 1, activationConditions: [] },
      { id: "scene-3", name: "Scene 3", widgets: [widget("s3-w1")], priority: 2, activationConditions: [] },
    ];
    const projectWithScenes: Project = {
      ...project,
      themeProjectGroups: project.themeProjectGroups.map((group) => ({
        ...group,
        themeProjects: group.themeProjects.map((theme) => ({
          ...theme,
          rotations: theme.rotations.map((rotation) => rotation.id === rotationId ? { ...rotation, scenes } : rotation),
        })),
      })),
    };
    const { store, editor } = setup(projectWithScenes);
    const before = structuredClone(current(store));
    expect(editor.moveScene(rotationId, "scene-3", 0).changed).toBe(true);
    const after = structuredClone(current(store));
    const moved = after.themeProjectGroups[0].themeProjects[0].rotations[0].scenes;
    expect(moved.map((scene) => scene.id)).toEqual(["scene-3", "scene-1", "scene-2"]);
    expect(moved.map((scene) => scene.widgets[0]?.id)).toEqual(["s3-w1", "s1-w1", "s2-w1"]);
    expect(moved.every((scene) => scene.id.startsWith("scene-") && Array.isArray(scene.widgets))).toBe(true);
    expect(store.undo()).toBe(true);
    expect(current(store)).toEqual(before);
    expect(store.redo()).toBe(true);
    expect(current(store)).toEqual(after);
  });

  it("re-dimensions every Rotation and clamps widgets when the DeviceProfile changes", () => {
    const { project, sceneId } = hierarchyProject();
    const { store, editor } = setup(project);
    const before = structuredClone(current(store));
    // A profile switch is a geometry-contract change: stale Rotation
    // dimensions would silently corrupt every scene-unit coordinate.
    expect(editor.setProjectDeviceProfile("compact-profile", { width: 240, height: 320 }).changed).toBe(true);
    const after = current(store);
    expect(after.deviceProfileId).toBe("compact-profile");
    for (const rotation of after.themeProjectGroups[0].themeProjects[0].rotations) {
      const expected = rotation.angle === 90 || rotation.angle === 270 ? { width: 320, height: 240 } : { width: 240, height: 320 };
      expect({ width: rotation.width, height: rotation.height }).toEqual(expected);
      for (const scene of rotation.scenes) {
        for (const item of scene.widgets) {
          expect(item.geometry.x).toBeGreaterThanOrEqual(0);
          expect(item.geometry.y).toBeGreaterThanOrEqual(0);
          expect(item.geometry.x + item.geometry.width).toBeLessThanOrEqual(rotation.width);
          expect(item.geometry.y + item.geometry.height).toBeLessThanOrEqual(rotation.height);
        }
      }
    }
    expect(sceneId.length).toBeGreaterThan(0);
    expect(store.undo()).toBe(true);
    expect(current(store)).toEqual(before);
  });

  it("edits Widget properties immutably and restores exact state", () => {
    const { project, sceneId } = hierarchyProject();
    const { store, editor } = setup(project);
    const before = structuredClone(current(store));
    // Name/visibility and geometry are separate commands on purpose: the
    // geometry path refuses locked widgets, the property path never touches
    // geometry. Each is independently undoable.
    expect(editor.setWidgetsPropertiesInScene(sceneId, ["w1"], { name: "Edited", visible: false }).changed).toBe(true);
    const afterProperties = structuredClone(current(store));
    expect(afterProperties.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[0]).toMatchObject({ name: "Edited", visible: false });
    expect(editor.setWidgetGeometriesInScene(sceneId, { w1: { x: 100, y: 110, width: 120, height: 50 } }).changed).toBe(true);
    const after = structuredClone(current(store));
    expect(after.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[0]).toMatchObject({ name: "Edited", visible: false, geometry: { x: 100, y: 110, width: 120, height: 50 } });
    expect(store.undo()).toBe(true);
    expect(current(store)).toEqual(afterProperties);
    expect(store.undo()).toBe(true);
    expect(current(store)).toEqual(before);
    expect(store.redo()).toBe(true);
    expect(store.redo()).toBe(true);
    expect(current(store)).toEqual(after);
  });

  it("deletes and duplicates the selected Widget with correct parent and identity", () => {
    const { project, sceneId } = hierarchyProject();
    const { store, editor } = setup(project);
    const original = structuredClone(current(store));
    expect(editor.duplicateSelection(["w1"]).changed).toBe(true);
    const duplicated = structuredClone(current(store));
    const duplicatedWidgets = duplicated.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets;
    expect(duplicatedWidgets).toHaveLength(4);
    expect(duplicatedWidgets[0]).toEqual(original.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[0]);
    expect(duplicatedWidgets[1].id).not.toBe("w1");
    expect(duplicatedWidgets[1].content).toEqual({ text: "w1" });
    expect(duplicatedWidgets[1].geometry).toEqual({ x: 20, y: 20, width: 100, height: 40 });
    expect(store.undo()).toBe(true);
    expect(current(store)).toEqual(original);
    expect(store.redo()).toBe(true);
    expect(current(store)).toEqual(duplicated);

    expect(editor.deleteSelection(["w2"]).changed).toBe(true);
    const deleted = current(store).themeProjectGroups[0].themeProjects[0].rotations[0].scenes.find((scene) => scene.id === sceneId)!;
    expect(deleted.widgets.some((item) => item.id === "w2")).toBe(false);
  });

  it("does not record invalid or no-op mutations", () => {
    const { project, rotationId } = hierarchyProject();
    const { store, editor } = setup(project);
    const before = current(store);
    const snapshot = store.getSnapshot();
    expect(editor.addScene("missing-rotation").changed).toBe(false);
    expect(editor.moveScene(rotationId, "scene-1", 0).changed).toBe(false);
    expect(editor.moveScene("missing-rotation", "scene-1", 0).changed).toBe(false);
    expect(editor.setWidgetConfiguration("scene-1", "missing-widget", { content: { text: "x" } }).changed).toBe(false);
    expect(editor.deleteSelection(["missing-node"]).changed).toBe(false);
    expect(editor.duplicateSelection([]).changed).toBe(false);
    expect(current(store)).toBe(before);
    expect(store.getSnapshot()).toBe(snapshot);
    expect(store.getSnapshot().isDirty).toBe(false);
    expect(store.getSnapshot().history.undoCount).toBe(0);
    expect(store.getSnapshot().history.redoCount).toBe(0);
  });

  it("starts New Project with a clean, isolated document history", () => {
    const { store, editor } = setup();
    expect(editor.addThemeProject(current(store).themeProjectGroups[0].id, "Old Theme").changed).toBe(true);
    expect(store.getSnapshot().isDirty).toBe(true);
    expect(store.getSnapshot().history.undoCount).toBe(1);
    const next = createEmptyProject("New Project");
    store.create(next);
    expect(current(store)).toEqual(next);
    expect(store.getSnapshot()).toMatchObject({ isOpen: true, isDirty: false, history: { canUndo: false, canRedo: false, undoCount: 0, redoCount: 0 } });
    expect(store.undo()).toBe(false);
    expect(store.redo()).toBe(false);
  });

  it("keeps failed undo and redo commands available", () => {
    const history = new CommandHistory();
    let value = 0;
    let failUndo = true;
    const undoCommand = { label: "Undo Failure", execute: () => { value = 1; }, undo: () => { if (failUndo) throw new Error("undo failure"); value = 0; } };
    history.execute(undoCommand);
    expect(() => history.undo()).toThrow("undo failure");
    expect(value).toBe(1);
    expect(history.canUndo).toBe(true);
    failUndo = false;
    expect(history.undo()).toBe(true);
    expect(value).toBe(0);
    expect(history.canRedo).toBe(true);

    let failRedo = false;
    const redoCommand = { label: "Redo Failure", execute: () => { if (failRedo) throw new Error("redo failure"); value = 2; }, undo: () => { value = 0; } };
    history.clear();
    history.execute(redoCommand);
    expect(history.undo()).toBe(true);
    failRedo = true;
    expect(() => history.redo()).toThrow("redo failure");
    expect(value).toBe(0);
    expect(history.canRedo).toBe(true);
    failRedo = false;
    expect(history.redo()).toBe(true);
    expect(value).toBe(2);
  });

  it("clears redo history when a new branch mutation is executed", () => {
    const { project, groupId } = hierarchyProject();
    const { store, editor } = setup(project);
    expect(editor.addThemeProject(groupId, "A").changed).toBe(true);
    expect(editor.addThemeProject(groupId, "B").changed).toBe(true);
    expect(store.undo()).toBe(true);
    expect(store.getSnapshot().history.canRedo).toBe(true);
    expect(editor.addThemeProject(groupId, "C").changed).toBe(true);
    expect(store.getSnapshot().history.canRedo).toBe(false);
    const names = current(store).themeProjectGroups[0].themeProjects.map((theme) => theme.name);
    expect(names).toEqual(["Theme 1", "A", "C"]);
  });

  it("returns to clean after undoing to the saved baseline and becomes dirty after redo", () => {
    const { store, editor } = setup();
    const groupId = current(store).themeProjectGroups[0].id;
    expect(editor.addThemeProject(groupId, "A").changed).toBe(true);
    store.save();
    expect(store.getSnapshot().isDirty).toBe(false);
    expect(editor.addThemeProject(groupId, "B").changed).toBe(true);
    expect(store.getSnapshot().isDirty).toBe(true);
    expect(store.undo()).toBe(true);
    expect(store.getSnapshot().isDirty).toBe(false);
    expect(store.redo()).toBe(true);
    expect(store.getSnapshot().isDirty).toBe(true);
  });

  it("emits one document notification per mutation, undo and redo", () => {
    const { store, editor } = setup();
    let notifications = 0;
    const unsubscribe = store.subscribe(() => { notifications += 1; });
    const groupId = current(store).themeProjectGroups[0].id;
    expect(editor.addThemeProject(groupId, "A").changed).toBe(true);
    expect(notifications).toBe(1);
    expect(store.undo()).toBe(true);
    expect(notifications).toBe(2);
    expect(store.redo()).toBe(true);
    expect(notifications).toBe(3);
    unsubscribe();
  });

  it("blocks locked geometry at the application boundary while allowing other properties", () => {
    const { project, sceneId } = hierarchyProject();
    const lockedProject: Project = {
      ...project,
      themeProjectGroups: project.themeProjectGroups.map((group) => ({
        ...group,
        themeProjects: group.themeProjects.map((theme) => ({
          ...theme,
          rotations: theme.rotations.map((rotation) => ({
            ...rotation,
            scenes: rotation.scenes.map((scene) => ({
              ...scene,
              widgets: scene.widgets.map((item) => item.id === "w1" ? { ...item, locked: true } : item),
            })),
          })),
        })),
      })),
    };
    const { store, editor } = setup(lockedProject);
    const before = structuredClone(current(store));
    // A locked widget refuses geometry through every geometry path...
    expect(editor.setWidgetGeometriesInScene(sceneId, { w1: { x: 99, y: 99, width: 99, height: 99 } }).changed).toBe(false);
    expect(current(store)).toEqual(before);
    // ...while non-geometry properties stay editable and its geometry is untouched.
    expect(editor.setWidgetsPropertiesInScene(sceneId, ["w1"], { name: "Locked Rename" }).changed).toBe(true);
    const widgetAfter = current(store).themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[0];
    expect(widgetAfter.name).toBe("Locked Rename");
    expect(widgetAfter.locked).toBe(true);
    expect(widgetAfter.geometry).toEqual(before.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[0].geometry);
    // Type-specific configuration is also refused no geometry route exists for it.
    expect(editor.setWidgetConfiguration(sceneId, "w1", { content: { text: "still editable" } }).changed).toBe(true);
    expect(current(store).themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[0].geometry).toEqual(before.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[0].geometry);
  });

  it("refuses to delete the last Theme Project Group and allows deleting additional groups", () => {
    const { project, groupId } = hierarchyProject();
    const { store, editor } = setup(project);
    const before = structuredClone(current(store));
    expect(editor.deleteSelection([groupId]).changed).toBe(false);
    expect(current(store)).toEqual(before);
    expect(store.getSnapshot().history.undoCount).toBe(0);

    const secondGroup = { ...before.themeProjectGroups[0], id: "extra-group", name: "Extra Group" };
    const twoGroups: Project = { ...before, themeProjectGroups: [...before.themeProjectGroups, secondGroup] };
    const second = setup(twoGroups);
    expect(second.editor.deleteSelection(["extra-group"]).changed).toBe(true);
    expect(current(second.store).themeProjectGroups).toHaveLength(1);
    expect(second.store.undo()).toBe(true);
    expect(current(second.store)).toEqual(twoGroups);
  });
});
