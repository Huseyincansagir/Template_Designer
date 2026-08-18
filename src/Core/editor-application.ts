import type { Binding, DeviceProfile, Geometry, Project, Rotation, RotationAngle, Scene, ThemeProject, ThemeProjectGroup, Widget } from "../Domain/models";
import { InMemoryDocumentStore } from "./document-store";

export type ProjectMutation = (project: Project) => Project;
export type MutationResult = { readonly changed: boolean; readonly createdIds?: readonly string[] };

function clone<T>(value: T): T { return structuredClone(value); }
function newId(prefix: string): string { return `${prefix}-${crypto.randomUUID()}`; }
function equalProject(left: Project, right: Project): boolean { return JSON.stringify(left) === JSON.stringify(right); }

function isValidGeometry(value: unknown): value is Geometry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return Object.keys(candidate).length === 4
    && ["x", "y", "width", "height"].every((key) => typeof candidate[key] === "number" && Number.isFinite(candidate[key]))
    && (candidate.width as number) > 0
    && (candidate.height as number) > 0;
}

function rotationDimensions(display: DeviceProfile["display"], angle: RotationAngle): Pick<Rotation, "width" | "height"> {
  return angle === 90 || angle === 270
    ? { width: display.height, height: display.width }
    : { width: display.width, height: display.height };
}

export function defaultWidgetName(widgetType: string): string {
  const label = widgetType.replace(/[-_]/g, " ").trim();
  return label.length > 0 ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : "Widget";
}

function findUniqueScene(project: Project, sceneId: string): Scene | undefined {
  let found: Scene | undefined;
  let count = 0;
  for (const group of project.themeProjectGroups) {
    for (const theme of group.themeProjects) {
      for (const rotation of theme.rotations) {
        for (const scene of rotation.scenes) {
          if (scene.id === sceneId) {
            found = scene;
            count += 1;
          }
        }
      }
    }
  }
  return count === 1 ? found : undefined;
}

function countWidgetOccurrences(project: Project, widgetId: string): number {
  return project.themeProjectGroups.reduce((groupCount, group) => groupCount + group.themeProjects.reduce((themeCount, theme) => themeCount + theme.rotations.reduce((rotationCount, rotation) => rotationCount + rotation.scenes.reduce((sceneCount, scene) => sceneCount + scene.widgets.filter((widget) => widget.id === widgetId).length, 0), 0), 0), 0);
}

function validScopedWidgetIds(project: Project, sceneId: string, ids: readonly string[]): boolean {
  const scene = findUniqueScene(project, sceneId);
  if (!scene || !ids.length || new Set(ids).size !== ids.length) return false;
  return ids.every((id) => countWidgetOccurrences(project, id) === 1 && scene.widgets.filter((widget) => widget.id === id).length === 1);
}

function validGlobalGeometryUpdates(project: Project, updates: Readonly<Record<string, Geometry>>): boolean {
  const ids = Object.keys(updates);
  return ids.length > 0 && ids.every((id) => countWidgetOccurrences(project, id) === 1 && isValidGeometry(updates[id]));
}

function mapSceneWidgets(scene: Scene, map: (widget: Widget) => Widget): Scene {
  return { ...scene, widgets: scene.widgets.map(map) };
}

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

function duplicateWidget(widget: Widget, id: string = newId("widget")): Widget {
  return {
    ...clone(widget),
    id,
    name: `${widget.name} Copy`,
    geometry: { ...widget.geometry, x: widget.geometry.x + 10, y: widget.geometry.y + 10 },
    // Bindings are re-parented to the copy (new binding ids, widgetId → copy).
    // Cloning them verbatim would leave the copy referencing the original and
    // immediately fail BINDING_WIDGET_MISMATCH validation.
    bindings: widget.bindings.map((binding) => ({ ...clone(binding), id: newId("binding"), widgetId: id })),
  };
}

/** Stable copy-ID map in Scene document order, built before mutation so undo/redo stay deterministic. */
function buildDuplicateIdMap(project: Project, selected: ReadonlySet<string>): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const group of project.themeProjectGroups) {
    for (const theme of group.themeProjects) {
      for (const rotation of theme.rotations) {
        for (const scene of rotation.scenes) {
          for (const widget of scene.widgets) {
            if (selected.has(widget.id) && !map.has(widget.id)) map.set(widget.id, newId("widget"));
          }
        }
      }
    }
  }
  return map;
}

function duplicateScene(scene: Scene): Scene {
  return {
    ...clone(scene),
    id: newId("scene"),
    name: `${scene.name} Copy`,
    widgets: scene.widgets.map((widget) => duplicateWidget(widget)),
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

  addRotation(themeId: string, angle: RotationAngle = 0, display?: DeviceProfile["display"]): MutationResult {
    if (!display || !Number.isFinite(display.width) || !Number.isFinite(display.height) || display.width <= 0 || display.height <= 0) return { changed: false };
    const dimensions = rotationDimensions(display, angle);
    return this.execute(`Add Rotation: R${angle}`, (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => theme.id === themeId ? {
      ...theme,
      rotations: [...theme.rotations, { id: newId("rotation"), angle, ...dimensions, scenes: [] }],
    } : theme)));
  }

  addScene(rotationId: string, name = "New Scene"): MutationResult {
    return this.execute(`Add Scene: ${name}`, (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => rotation.id === rotationId ? {
      ...rotation,
      scenes: [...rotation.scenes, { id: newId("scene"), name, widgets: [], priority: 0, activationConditions: [] }],
    } : rotation))));
  }

  /**
   * Undoable, scene-scoped widget creation. Geometry is validated with the
   * same rules as every other geometry mutation; the widget is appended at
   * the top of the Scene's z-order (max zIndex + 1). Profile capability
   * filtering happens at the UI layer where the DeviceProfile lives.
   */
  addWidget(sceneId: string, widgetType: string, geometry?: Geometry): MutationResult {
    const current = this.documents.getCurrent();
    if (!current || widgetType.trim().length === 0 || !findUniqueScene(current, sceneId)) return { changed: false };
    const base = geometry ?? { x: 0, y: 0, width: 120, height: 80 };
    if (!isValidGeometry(base)) return { changed: false };
    const id = newId("widget");
    const result = this.execute(`Add Widget: ${widgetType}`, (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (scene) => {
      if (scene.id !== sceneId) return scene;
      const maxZ = scene.widgets.reduce((maximum, widget) => Math.max(maximum, widget.zIndex), 0);
      const widget: Widget = {
        id,
        name: defaultWidgetName(widgetType),
        widgetType,
        enabled: true,
        visible: true,
        locked: false,
        geometry: clone(base),
        zIndex: maxZ + 1,
        bindings: [],
        assetIds: [],
      };
      return { ...scene, widgets: [...scene.widgets, widget] };
    })))));
    return result.changed ? { changed: true, createdIds: [id] } : result;
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

  /**
   * Undoable rename for any canonical node (Project, Group, Theme, Rotation,
   * Scene, Widget, Asset). Stable IDs never change; empty names are refused.
   */
  renameNode(id: string, name: string): MutationResult {
    const trimmed = name.trim();
    if (trimmed.length === 0) return { changed: false };
    return this.execute(`Rename to ${trimmed}`, (project) => {
      if (project.id === id) return { ...project, name: trimmed };
      if (project.assets.some((asset) => asset.id === id)) {
        return { ...project, assets: project.assets.map((asset) => asset.id === id ? { ...asset, name: trimmed } : asset) };
      }
      return mapProjectGroups(project, (group) => {
        if (group.id === id) return { ...group, name: trimmed };
        return mapThemeProjects(group, (theme) => {
          if (theme.id === id) return { ...theme, name: trimmed };
          return mapRotations(theme, (rotation) => {
            // Rotations carry no display name in the Domain model; only their
            // children are renameable.
            if (rotation.id === id) return rotation;
            return mapScenes(rotation, (scene) => {
              if (scene.id === id) return { ...scene, name: trimmed };
              if (!scene.widgets.some((widget) => widget.id === id)) return scene;
              return { ...scene, widgets: scene.widgets.map((widget) => widget.id === id ? { ...widget, name: trimmed } : widget) };
            });
          });
        });
      });
    });
  }

  setSceneProperties(sceneId: string, patch: Partial<Pick<Scene, "name" | "priority" | "enabled" | "activationConditionMode">>): MutationResult {
    if (patch.name !== undefined && patch.name.trim().length === 0) return { changed: false };
    if (patch.priority !== undefined && (!Number.isInteger(patch.priority) || patch.priority < 0 || patch.priority > 10)) return { changed: false };
    const current = this.documents.getCurrent();
    if (!current || !findUniqueScene(current, sceneId)) return { changed: false };
    return this.execute("Edit Scene Properties", (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (scene) => scene.id === sceneId ? { ...scene, ...clone(patch), ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) } : scene)))));
  }

  setWidgetsVisibilityInScene(sceneId: string, ids: readonly string[], visible: boolean): MutationResult {
    const current = this.documents.getCurrent();
    if (!current || !validScopedWidgetIds(current, sceneId, ids)) return { changed: false };
    const selected = new Set(ids);
    return this.execute(visible ? "Show Widgets" : "Hide Widgets", (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (scene) => scene.id === sceneId ? { ...scene, widgets: scene.widgets.map((widget) => selected.has(widget.id) ? { ...widget, visible } : widget) } : scene)))));
  }

  /** Duplicate-mode placement: copies centered at the given Scene point, one undoable command. */
  duplicateWidgetsAt(sceneId: string, ids: readonly string[], center: { x: number; y: number }): MutationResult {
    const current = this.documents.getCurrent();
    if (!current || !validScopedWidgetIds(current, sceneId, ids)) return { changed: false };
    const scene = findUniqueScene(current, sceneId);
    const selectedWidgets = scene?.widgets.filter((widget) => ids.includes(widget.id)) ?? [];
    if (!selectedWidgets.length) return { changed: false };
    const bounds = selectedWidgets.reduce(
      (accumulator, widget) => ({
        left: Math.min(accumulator.left, widget.geometry.x),
        top: Math.min(accumulator.top, widget.geometry.y),
        right: Math.max(accumulator.right, widget.geometry.x + widget.geometry.width),
        bottom: Math.max(accumulator.bottom, widget.geometry.y + widget.geometry.height),
      }),
      { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY },
    );
    const offset = {
      x: center.x - (bounds.left + (bounds.right - bounds.left) / 2),
      y: center.y - (bounds.top + (bounds.bottom - bounds.top) / 2),
    };
    const selected = new Set(ids);
    const copyIds = buildDuplicateIdMap(current, selected);
    const createdIds = ids.filter((id) => copyIds.has(id)).map((id) => copyIds.get(id) as string);
    const result = this.execute("Duplicate Widgets at Point", (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (candidate) => {
      if (candidate.id !== sceneId) return candidate;
      return { ...candidate, widgets: candidate.widgets.flatMap((widget) => {
        const copyId = copyIds.get(widget.id);
        if (!copyId) return [widget];
        const copy = duplicateWidget(widget, copyId);
        // Duplicate-mode placement centers the copy exactly on the click
        // point; the fixed +10/+10 copy offset is not applied here.
        return [widget, { ...copy, geometry: { ...widget.geometry, x: widget.geometry.x + offset.x, y: widget.geometry.y + offset.y } }];
      }) };
    })))));
    return result.changed ? { changed: true, createdIds } : result;
  }

  /** Binding editor: replaces the widget's binding list in one undoable command. */
  replaceWidgetBindings(sceneId: string, widgetId: string, bindings: readonly Binding[]): MutationResult {
    const current = this.documents.getCurrent();
    if (!current || !validScopedWidgetIds(current, sceneId, [widgetId])) return { changed: false };
    if (!bindings.every((binding) => binding.id.trim().length > 0 && binding.widgetId === widgetId && binding.conditions.length > 0)) return { changed: false };
    return this.execute("Edit Widget Bindings", (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (scene) => scene.id === sceneId ? { ...scene, widgets: scene.widgets.map((widget) => widget.id === widgetId ? { ...widget, bindings: clone(bindings) } : widget) } : scene)))));
  }

  setProjectDeviceProfile(profileId: string): MutationResult {
    if (profileId.trim().length === 0) return { changed: false };
    return this.execute("Switch Device Profile", (project) => ({ ...project, deviceProfileId: profileId }));
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
    const current = this.documents.getCurrent();
    if (!current || !validGlobalGeometryUpdates(current, updates)) return { changed: false };
    return this.execute(label, (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (scene) => mapSceneWidgets(scene, (widget) => {
      const geometry = updates[widget.id];
      return geometry && !widget.locked ? { ...widget, geometry: clone(geometry) } : widget;
    }))))));
  }

  setWidgetGeometriesInScene(sceneId: string, updates: Readonly<Record<string, Geometry>>, label = "Edit Widget Geometry"): MutationResult {
    const current = this.documents.getCurrent();
    const ids = Object.keys(updates);
    if (!current || !validScopedWidgetIds(current, sceneId, ids) || !ids.every((id) => isValidGeometry(updates[id]))) return { changed: false };
    return this.execute(label, (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (scene) => scene.id === sceneId ? mapSceneWidgets(scene, (widget) => {
      const geometry = updates[widget.id];
      return geometry && !widget.locked ? { ...widget, geometry: clone(geometry) } : widget;
    }) : scene)))));
  }

  editWidgetProperties(sceneId: string, widgetId: string, patch: Partial<Pick<Widget, "name" | "enabled" | "visible" | "locked" | "geometry" | "zIndex" | "content" | "style">>): MutationResult {
    const current = this.documents.getCurrent();
    if (!current || !validScopedWidgetIds(current, sceneId, [widgetId]) || (patch.geometry !== undefined && !isValidGeometry(patch.geometry))) return { changed: false };
    return this.execute("Edit Widget Properties", (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (scene) => scene.id === sceneId ? {
      ...scene,
      widgets: scene.widgets.map((widget) => {
        if (widget.id !== widgetId) return widget;
        const { geometry, ...editablePatch } = clone(patch);
        return { ...widget, ...editablePatch, ...(widget.locked || geometry === undefined ? {} : { geometry }) };
      }),
    } : scene)))));
  }

  /**
   * Bulk non-geometry property patch (name/enabled/visible/locked/zIndex)
   * for multi-selection apply-to-all. Geometry is deliberately excluded so
   * locked widgets can never have their geometry mutated through this path.
   */
  setWidgetsPropertiesInScene(sceneId: string, ids: readonly string[], patch: Partial<Pick<Widget, "name" | "enabled" | "visible" | "locked" | "zIndex">>): MutationResult {
    const current = this.documents.getCurrent();
    if (!current || !validScopedWidgetIds(current, sceneId, ids)) return { changed: false };
    if (patch.zIndex !== undefined && !Number.isFinite(patch.zIndex)) return { changed: false };
    if (patch.name !== undefined && patch.name.trim().length === 0) return { changed: false };
    const selected = new Set(ids);
    const cleanPatch: Partial<Widget> = {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.visible !== undefined ? { visible: patch.visible } : {}),
      ...(patch.locked !== undefined ? { locked: patch.locked } : {}),
      ...(patch.zIndex !== undefined ? { zIndex: patch.zIndex } : {}),
    };
    return this.execute("Edit Widget Properties", (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (scene) => scene.id === sceneId ? { ...scene, widgets: scene.widgets.map((widget) => selected.has(widget.id) ? { ...widget, ...clone(cleanPatch) } : widget) } : scene)))));
  }

  deleteSelection(ids: readonly string[]): MutationResult {
    if (!ids.length) return { changed: false };
    const current = this.documents.getCurrent();
    if (current) {
      const selected = new Set(ids);
      const remainingGroups = current.themeProjectGroups.filter((group) => !selected.has(group.id));
      // Deleting the last Theme Project Group leaves the editor with no
      // reachable hierarchy (Add Theme Project requires a group). The Core
      // refuses the mutation; the UI surfaces the reason.
      if (current.themeProjectGroups.length > 0 && remainingGroups.length === 0) return { changed: false };
    }
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

  deleteSelectionInScene(sceneId: string, ids: readonly string[]): MutationResult {
    const current = this.documents.getCurrent();
    if (!current || !validScopedWidgetIds(current, sceneId, ids)) return { changed: false };
    const selected = new Set(ids);
    return this.execute("Delete Widget Selection", (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (scene) => scene.id === sceneId ? { ...scene, widgets: scene.widgets.filter((widget) => !selected.has(widget.id)) } : scene)))));
  }

  setWidgetZIndicesInScene(sceneId: string, updates: Readonly<Record<string, number>>, label = "Change Widget Z-order"): MutationResult {
    const current = this.documents.getCurrent();
    const ids = Object.keys(updates);
    if (!current || !validScopedWidgetIds(current, sceneId, ids) || !ids.every((id) => Number.isFinite(updates[id]))) return { changed: false };
    // Locked widgets keep their zIndex (defense in depth; the UI-level
    // z-order computation already refuses locked targets).
    const scene = findUniqueScene(current, sceneId);
    const lockedIds = new Set(scene?.widgets.filter((widget) => widget.locked).map((widget) => widget.id));
    const applicableIds = ids.filter((id) => !lockedIds.has(id));
    if (!applicableIds.length) return { changed: false };
    return this.execute(label, (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (candidate) => candidate.id === sceneId ? { ...candidate, widgets: candidate.widgets.map((widget) => applicableIds.includes(widget.id) ? { ...widget, zIndex: updates[widget.id] } : widget) } : candidate)))));
  }

  duplicateSelectionInScene(sceneId: string, ids: readonly string[]): MutationResult {
    const current = this.documents.getCurrent();
    if (!current || !validScopedWidgetIds(current, sceneId, ids)) return { changed: false };
    const selected = new Set(ids);
    const copyIds = buildDuplicateIdMap(current, selected);
    const createdIds = ids.filter((id) => copyIds.has(id)).map((id) => copyIds.get(id) as string);
    const result = this.execute("Duplicate Widget Selection", (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (scene) => {
      if (scene.id !== sceneId) return scene;
      return { ...scene, widgets: scene.widgets.flatMap((widget) => {
        const copyId = copyIds.get(widget.id);
        return copyId ? [widget, duplicateWidget(widget, copyId)] : [widget];
      }) };
    })))));
    return result.changed ? { changed: true, createdIds } : result;
  }

  /**
   * Clipboard paste: inserts fresh copies of the given widget templates into
   * a Scene (potentially a different Scene than the source). Bindings are
   * re-parented to the copies; z-order continues at the top of the target
   * Scene's stack.
   */
  insertWidgetCopies(sceneId: string, templates: readonly Widget[]): MutationResult {
    const current = this.documents.getCurrent();
    if (!current || !findUniqueScene(current, sceneId) || templates.length === 0) return { changed: false };
    if (!templates.every((template) => isValidGeometry(template.geometry))) return { changed: false };
    const copyIds = templates.map(() => newId("widget"));
    const result = this.execute("Paste Widgets", (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (scene) => {
      if (scene.id !== sceneId) return scene;
      const baseZ = scene.widgets.reduce((maximum, widget) => Math.max(maximum, widget.zIndex), 0);
      const copies = templates.map((template, index) => ({
        ...duplicateWidget(template, copyIds[index]),
        zIndex: baseZ + 1 + index,
      }));
      return { ...scene, widgets: [...scene.widgets, ...copies] };
    })))));
    return result.changed ? { changed: true, createdIds: copyIds } : result;
  }

  duplicateSelection(ids: readonly string[]): MutationResult {    if (!ids.length) return { changed: false };
    const current = this.documents.getCurrent();
    const selected = new Set(ids);
    if (!current) return { changed: false };
    const copyIds = buildDuplicateIdMap(current, selected);
    const createdIds = ids.filter((id) => copyIds.has(id)).map((id) => copyIds.get(id) as string);
    const result = this.execute("Duplicate Selection", (project) => mapProjectGroups(project, (group) => {
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
              const copyId = copyIds.get(widget.id);
              if (copyId) widgets.push(duplicateWidget(widget, copyId));
            }
            scenes.push({ ...scene, widgets });
          }
          rotations.push({ ...rotation, scenes });
        }
        themeProjects.push({ ...theme, rotations });
      }
      return { ...group, themeProjects };
    }));
    return result.changed ? { changed: true, createdIds } : result;
  }
}

export function createEditorApplication(store: InMemoryDocumentStore): EditorApplication {
  return new EditorApplication(store);
}
