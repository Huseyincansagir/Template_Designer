import type { Geometry, Project, Rotation, RotationAngle, Scene, ThemeProject, ThemeProjectGroup, Widget } from "../Domain/models";
import { InMemoryDocumentStore } from "./document-store";

export type ProjectMutation = (project: Project) => Project;
export type MutationResult = { readonly changed: boolean };

function clone<T>(value: T): T { return structuredClone(value); }
function newId(prefix: string): string { return `${prefix}-${crypto.randomUUID()}`; }
function equalProject(left: Project, right: Project): boolean { return JSON.stringify(left) === JSON.stringify(right); }

function mapProjectGroups(project: Project, map: (group: ThemeProjectGroup) => ThemeProjectGroup): Project {
  return { ...project, themeProjectGroups: project.themeProjectGroups.map(map) };
}

function mapThemeProjects(group: ThemeProjectGroup, map: (theme: ThemeProject) => ThemeProject): ThemeProjectGroup {
  return { ...group, themeProjects: group.themeProjects.map(map) };
}

function mapRotations(theme: ThemeProject, map: (rotation: Rotation) => Rotation): ThemeProject {
  return { ...theme, rotations: theme.rotations.map(map) };
}

function mapScenes(rotation: Rotation, map: (scene: Scene) => Scene): Rotation {
  return { ...rotation, scenes: rotation.scenes.map(map) };
}

function mapWidgets(scene: Scene, map: (widget: Widget) => Widget): Scene {
  return { ...scene, widgets: scene.widgets.map(map) };
}

function duplicateWidget(widget: Widget): Widget {
  return {
    ...clone(widget),
    id: newId("widget"),
    name: `${widget.name} Copy`,
    geometry: { ...widget.geometry, x: widget.geometry.x + 10, y: widget.geometry.y + 10 },
  };
}

function duplicateScene(scene: Scene): Scene {
  return {
    ...clone(scene),
    id: newId("scene"),
    name: `${scene.name} Copy`,
    widgets: scene.widgets.map(duplicateWidget),
  };
}

function duplicateRotation(rotation: Rotation): Rotation {
  return {
    ...clone(rotation),
    id: newId("rotation"),
    scenes: rotation.scenes.map(duplicateScene),
  };
}

function duplicateThemeProject(theme: ThemeProject): ThemeProject {
  return {
    ...clone(theme),
    id: newId("theme"),
    name: `${theme.name} Copy`,
    rotations: theme.rotations.map(duplicateRotation),
  };
}

export class EditorApplication {
  constructor(readonly documents: InMemoryDocumentStore) {}

  executeCommand(command: { readonly label: string; execute(): void; undo(): void }): void {
    this.documents.execute(command);
  }

  execute(label: string, mutation: ProjectMutation): MutationResult {
    const current = this.documents.getCurrent();
    if (!current) throw new Error("No document is open");

    const before = clone(current);
    const after = mutation(clone(before));
    if (equalProject(before, after)) return { changed: false };

    this.documents.execute({
      label,
      execute: () => this.documents.replaceCurrent(clone(after)),
      undo: () => this.documents.replaceCurrent(clone(before)),
    });
    return { changed: true };
  }

  addThemeProject(groupId: string, name = "New Theme Project"): MutationResult {
    return this.execute(`Add Theme Project: ${name}`, (project) => mapProjectGroups(project, (group) => group.id === groupId ? {
      ...group,
      themeProjects: [...group.themeProjects, { id: newId("theme"), name, rotations: [], resources: [] }],
    } : group));
  }

  addRotation(themeId: string, angle: RotationAngle = 0): MutationResult {
    return this.execute(`Add Rotation: R${angle}`, (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => theme.id === themeId ? {
      ...theme,
      rotations: [...theme.rotations, { id: newId("rotation"), angle, width: 720, height: 1280, scenes: [] }],
    } : theme)));
  }

  addScene(rotationId: string, name = "New Scene"): MutationResult {
    return this.execute(`Add Scene: ${name}`, (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => rotation.id === rotationId ? {
      ...rotation,
      scenes: [...rotation.scenes, { id: newId("scene"), name, widgets: [], priority: 0, activationConditions: [] }],
    } : rotation))));
  }

  moveScene(rotationId: string, sceneId: string, toIndex: number): MutationResult {
    return this.execute("Move Scene", (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => {
      if (rotation.id !== rotationId || toIndex < 0 || toIndex >= rotation.scenes.length) return rotation;
      const fromIndex = rotation.scenes.findIndex((scene) => scene.id === sceneId);
      if (fromIndex < 0 || fromIndex === toIndex) return rotation;
      const scenes = [...rotation.scenes];
      const [scene] = scenes.splice(fromIndex, 1);
      scenes.splice(toIndex, 0, scene);
      return { ...rotation, scenes };
    }))));
  }

  moveWidget(sceneId: string, widgetId: string, toIndex: number): MutationResult {
    return this.execute("Move Widget", (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (scene) => {
      if (scene.id !== sceneId || toIndex < 0 || toIndex >= scene.widgets.length) return scene;
      const fromIndex = scene.widgets.findIndex((widget) => widget.id === widgetId);
      if (fromIndex < 0 || fromIndex === toIndex) return scene;
      const widgets = [...scene.widgets];
      const [widget] = widgets.splice(fromIndex, 1);
      widgets.splice(toIndex, 0, widget);
      return { ...scene, widgets };
    })))));
  }

  setWidgetGeometries(updates: Readonly<Record<string, Geometry>>, label = "Edit Widget Geometry"): MutationResult {
    return this.execute(label, (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (scene) => mapWidgets(scene, (widget) => {
      const geometry = updates[widget.id];
      return geometry && !widget.locked ? { ...widget, geometry: clone(geometry) } : widget;
    }))))));
  }

  editWidgetProperties(sceneId: string, widgetId: string, patch: Partial<Pick<Widget, "name" | "enabled" | "visible" | "locked" | "geometry" | "zIndex" | "content" | "style">>): MutationResult {
    return this.execute("Edit Widget Properties", (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (scene) => scene.id === sceneId ? {
      ...scene,
      widgets: scene.widgets.map((widget) => {
        if (widget.id !== widgetId) return widget;
        const { geometry, ...editablePatch } = clone(patch);
        return { ...widget, ...editablePatch, ...(widget.locked || geometry === undefined ? {} : { geometry }) };
      }),
    } : scene)))));
  }

  deleteSelection(ids: readonly string[]): MutationResult {
    if (!ids.length) return { changed: false };
    const selected = new Set(ids);
    return this.execute("Delete Selection", (project) => ({
      ...project,
      themeProjectGroups: project.themeProjectGroups
        .filter((group) => !selected.has(group.id))
        .map((group) => ({
          ...group,
          themeProjects: group.themeProjects
            .filter((theme) => !selected.has(theme.id))
            .map((theme) => ({
              ...theme,
              rotations: theme.rotations
                .filter((rotation) => !selected.has(rotation.id))
                .map((rotation) => ({
                  ...rotation,
                  scenes: rotation.scenes
                    .filter((scene) => !selected.has(scene.id))
                    .map((scene) => ({ ...scene, widgets: scene.widgets.filter((widget) => !selected.has(widget.id)) })),
                })),
            })),
        })),
    }));
  }

  duplicateSelection(ids: readonly string[]): MutationResult {
    if (!ids.length) return { changed: false };
    const selected = new Set(ids);
    return this.execute("Duplicate Selection", (project) => mapProjectGroups(project, (group) => {
      const themeProjects: ThemeProject[] = [];
      for (const theme of group.themeProjects) {
        if (selected.has(theme.id)) {
          themeProjects.push(theme, duplicateThemeProject(theme));
          continue;
        }

        const rotations: Rotation[] = [];
        for (const rotation of theme.rotations) {
          if (selected.has(rotation.id)) {
            rotations.push(rotation, duplicateRotation(rotation));
            continue;
          }

          const scenes: Scene[] = [];
          for (const scene of rotation.scenes) {
            if (selected.has(scene.id)) {
              scenes.push(scene, duplicateScene(scene));
              continue;
            }

            const widgets: Widget[] = [];
            for (const widget of scene.widgets) {
              widgets.push(widget);
              if (selected.has(widget.id)) widgets.push(duplicateWidget(widget));
            }
            scenes.push({ ...scene, widgets });
          }
          rotations.push({ ...rotation, scenes });
        }
        themeProjects.push({ ...theme, rotations });
      }
      return { ...group, themeProjects };
    }));
  }
}

export function createEditorApplication(store: InMemoryDocumentStore): EditorApplication {
  return new EditorApplication(store);
}
