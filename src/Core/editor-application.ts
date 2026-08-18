import type { Geometry, Project, RotationAngle, Scene, ThemeProject, Widget } from "../Domain/models";
import { InMemoryDocumentStore } from "./document-store";

export type ProjectMutation = (project: Project) => Project;

function clone<T>(value: T): T { return structuredClone(value); }
function newId(prefix: string): string { return `${prefix}-${crypto.randomUUID()}`; }

export class EditorApplication {
  constructor(readonly documents: InMemoryDocumentStore) {}

  executeCommand(command: { readonly label: string; execute(): void; undo(): void }): void {
    this.documents.execute(command);
  }

  execute(label: string, mutation: ProjectMutation): void {
    const before = clone(this.documents.getCurrent() ?? (() => { throw new Error("No document is open"); })());
    let after: Project | undefined;
    this.documents.execute({
      label,
      execute: () => {
        after = after ? clone(after) : mutation(clone(before));
        this.documents.replaceCurrent(clone(after));
      },
      undo: () => this.documents.replaceCurrent(clone(before)),
    });
  }

  addThemeProject(groupId: string, name = "New Theme Project"): void {
    this.execute(`Add Theme Project: ${name}`, (project) => ({
      ...project,
      themeProjectGroups: project.themeProjectGroups.map((group) => group.id === groupId ? {
        ...group,
        themeProjects: [...group.themeProjects, { id: newId("theme"), name, rotations: [], resources: [] }],
      } : group),
    }));
  }

  addRotation(themeId: string, angle: RotationAngle = 0): void {
    this.execute(`Add Rotation: R${angle}`, (project) => ({
      ...project,
      themeProjectGroups: project.themeProjectGroups.map((group) => ({ ...group, themeProjects: group.themeProjects.map((theme) => theme.id === themeId ? {
        ...theme,
        rotations: [...theme.rotations, { id: newId("rotation"), angle, width: 720, height: 1280, scenes: [] }],
      } : theme) })),
    }));
  }

  addScene(rotationId: string, name = "New Scene"): void {
    this.execute(`Add Scene: ${name}`, (project) => mapProject(project, (theme, rotation) => rotation.id === rotationId ? {
      ...rotation,
      scenes: [...rotation.scenes, { id: newId("scene"), name, widgets: [], priority: 0, activationConditions: [] }],
    } : rotation));
  }

  moveScene(rotationId: string, sceneId: string, toIndex: number): void {
    this.execute("Move Scene", (project) => mapProject(project, (theme, rotation) => {
      if (rotation.id !== rotationId) return rotation;
      const scenes = [...rotation.scenes];
      const from = scenes.findIndex((scene) => scene.id === sceneId);
      if (from < 0) return rotation;
      const [scene] = scenes.splice(from, 1);
      scenes.splice(Math.max(0, Math.min(toIndex, scenes.length)), 0, scene);
      return { ...rotation, scenes };
    }));
  }

  moveWidget(sceneId: string, widgetId: string, toIndex: number): void {
    this.execute("Move Widget", (project) => mapProject(project, (theme, rotation, scene) => {
      if (!scene) return rotation;
      if (scene.id !== sceneId) return scene;
      const widgets = [...scene.widgets];
      const from = widgets.findIndex((widget) => widget.id === widgetId);
      if (from < 0) return scene;
      const [widget] = widgets.splice(from, 1);
      widgets.splice(Math.max(0, Math.min(toIndex, widgets.length)), 0, widget);
      return { ...scene, widgets };
    }));
  }

  editWidgetProperties(sceneId: string, widgetId: string, patch: Partial<Pick<Widget, "name" | "enabled" | "visible" | "locked" | "geometry" | "zIndex" | "content" | "style">>): void {
    this.execute("Edit Widget Properties", (project) => mapProject(project, (theme, rotation, scene) => !scene ? rotation : scene.id === sceneId ? {
      ...scene,
      widgets: scene.widgets.map((widget) => widget.id === widgetId ? { ...widget, ...patch } : widget),
    } : scene));
  }

  deleteSelection(ids: readonly string[]): void {
    this.execute("Delete Selection", (project) => ({
      ...project,
      themeProjectGroups: project.themeProjectGroups.map((group) => ({ ...group,
        themeProjects: group.themeProjects.filter((theme) => !ids.includes(theme.id)).map((theme) => ({ ...theme,
          rotations: theme.rotations.filter((rotation) => !ids.includes(rotation.id)).map((rotation) => ({ ...rotation,
            scenes: rotation.scenes.filter((scene) => !ids.includes(scene.id)).map((scene) => ({ ...scene, widgets: scene.widgets.filter((widget) => !ids.includes(widget.id)) })),
          })),
        })),
      })),
    }));
  }

  duplicateSelection(ids: readonly string[]): void {
    this.execute("Duplicate Selection", (project) => ({
      ...project,
      themeProjectGroups: project.themeProjectGroups.map((group) => ({ ...group,
        themeProjects: group.themeProjects.flatMap((theme) => ids.includes(theme.id) ? [theme, { ...clone(theme), id: newId("theme"), name: `${theme.name} Copy` }] : [theme]),
      })),
    }));
  }
}

function mapProject(project: Project, map: (theme: ThemeProject, rotation: any, scene?: Scene) => any): Project {
  return {
    ...project,
    themeProjectGroups: project.themeProjectGroups.map((group) => ({ ...group,
      themeProjects: group.themeProjects.map((theme) => ({ ...theme,
        rotations: theme.rotations.map((rotation) => ({ ...mapRotation(rotation, theme, map) })),
      })),
    })),
  };
}
function mapRotation(rotation: any, theme: ThemeProject, map: (theme: ThemeProject, rotation: any, scene?: Scene) => any): any {
  const direct = map(theme, rotation);
  return { ...direct, scenes: direct.scenes.map((scene: Scene) => map(theme, rotation, scene)) };
}

export function createEditorApplication(store: InMemoryDocumentStore): EditorApplication { return new EditorApplication(store); }
