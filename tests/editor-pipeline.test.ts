import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../src/Domain/factories";
import { createEditorApplication } from "../src/Core/editor-application";
import { InMemoryDocumentStore } from "../src/Core/document-store";
import type { Widget } from "../src/Domain/models";

function setup() {
  const store = new InMemoryDocumentStore();
  store.create(createEmptyProject());
  return { store, editor: createEditorApplication(store) };
}

function widget(id: string): Widget {
  return { id, name: "Widget", widgetType: "text", enabled: true, visible: true, locked: false, geometry: { x: 0, y: 0, width: 100, height: 40 }, zIndex: 0, bindings: [] };
}

describe("canonical editor mutation pipeline", () => {
  it("keeps DocumentStore as source of truth and tracks clean/dirty lifecycle", () => {
    const { store, editor } = setup();
    const groupId = store.getCurrent()!.themeProjectGroups[0].id;
    expect(store.getSnapshot().isDirty).toBe(false);
    editor.addThemeProject(groupId, "Theme A");
    expect(store.getCurrent()!.themeProjectGroups[0].themeProjects[0].name).toBe("Theme A");
    expect(store.getSnapshot().isDirty).toBe(true);
    store.save();
    expect(store.getSnapshot().isDirty).toBe(false);
    store.close();
    expect(store.getSnapshot().isOpen).toBe(false);
  });

  it("routes theme, rotation, scene and widget mutations through undo/redo", () => {
    const { store, editor } = setup();
    const groupId = store.getCurrent()!.themeProjectGroups[0].id;
    editor.addThemeProject(groupId, "Theme A");
    const theme = store.getCurrent()!.themeProjectGroups[0].themeProjects[0];
    editor.addRotation(theme.id, 0);
    const rotation = store.getCurrent()!.themeProjectGroups[0].themeProjects[0].rotations[0];
    editor.addScene(rotation.id, "Scene A");
    const scene = store.getCurrent()!.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0];
    editor.execute("Add Widget", (project) => ({ ...project, themeProjectGroups: project.themeProjectGroups.map((group) => ({ ...group, themeProjects: group.themeProjects.map((currentTheme) => ({ ...currentTheme, rotations: currentTheme.rotations.map((currentRotation) => ({ ...currentRotation, scenes: currentRotation.scenes.map((currentScene) => currentScene.id === scene.id ? { ...currentScene, widgets: [widget("w1"), widget("w2")] } : currentScene) })) })) })) }));
    editor.editWidgetProperties(scene.id, "w1", { name: "Edited", geometry: { x: 15, y: 20, width: 120, height: 50 } });
    expect(store.getCurrent()!.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[0].name).toBe("Edited");
    editor.moveWidget(scene.id, "w1", 1);
    expect(store.getCurrent()!.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[1].id).toBe("w1");
    store.undo();
    expect(store.getCurrent()!.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[0].id).toBe("w1");
    store.redo();
    expect(store.getCurrent()!.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0].widgets[1].id).toBe("w1");
  });

  it("supports delete and duplicate selection as undoable commands", () => {
    const { store, editor } = setup();
    const groupId = store.getCurrent()!.themeProjectGroups[0].id;
    editor.addThemeProject(groupId, "Theme A");
    const themeId = store.getCurrent()!.themeProjectGroups[0].themeProjects[0].id;
    editor.duplicateSelection([themeId]);
    expect(store.getCurrent()!.themeProjectGroups[0].themeProjects).toHaveLength(2);
    editor.deleteSelection([themeId]);
    expect(store.getCurrent()!.themeProjectGroups[0].themeProjects).toHaveLength(1);
    store.undo();
    expect(store.getCurrent()!.themeProjectGroups[0].themeProjects).toHaveLength(2);
  });
});
