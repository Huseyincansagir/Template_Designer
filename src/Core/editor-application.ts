import type { Asset, Binding, Condition, DeviceProfile, Geometry, MediaType, Project, Rotation, RotationAngle, Scene, ThemeProject, ThemeProjectGroup, Widget } from "../Domain/models";
import { createStableId, type IdPrefix } from "../Domain/identity";
import { InMemoryDocumentStore } from "./document-store";

/** Identity comes from the single Domain generator; see Domain/identity.ts. */
function newId(prefix: IdPrefix): string { return createStableId(prefix); }

export type ProjectMutation = (project: Project) => Project;
export type MutationResult = { readonly changed: boolean; readonly createdIds?: readonly string[] };

/** Logical asset record an import source produces; the stable ID is allocated by the Core. */
export type AssetDraft = {
  readonly name: string;
  readonly sourcePath: string;
  /** Absent when the format is not one the importer could classify (F7c). */
  readonly mediaType?: MediaType;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
};

/** Widget configuration patch: the type-specific half of a Widget that geometry commands never touch. */
export type WidgetConfigurationPatch = Partial<Pick<Widget, "widgetType" | "mediaType" | "assetIds" | "audioAssetId" | "mediaSlide" | "content" | "style">>;

function clone<T>(value: T): T { return structuredClone(value); }

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

/** True when any of the given ids identifies a Rotation/Form node. */
function containsRotationId(project: Project, ids: readonly string[]): boolean {
  const candidates = new Set(ids);
  return project.themeProjectGroups.some((group) => group.themeProjects.some((theme) => theme.rotations.some((rotation) => candidates.has(rotation.id))));
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

/**
 * Depth-flattening helpers. Every canonical mutation below the Project walks
 * the same four levels; expressing that walk once removes the nested-closure
 * bracket hazard and keeps each command readable.
 */
function mapAllScenes(project: Project, map: (scene: Scene, rotation: Rotation, theme: ThemeProject) => Scene): Project {
  return {
    ...project,
    themeProjectGroups: project.themeProjectGroups.map((group) => ({
      ...group,
      themeProjects: group.themeProjects.map((theme) => ({
        ...theme,
        rotations: theme.rotations.map((rotation) => ({
          ...rotation,
          scenes: rotation.scenes.map((scene) => map(scene, rotation, theme)),
        })),
      })),
    })),
  };
}

function mapAllWidgets(project: Project, map: (widget: Widget) => Widget): Project {
  return mapAllScenes(project, (scene) => ({ ...scene, widgets: scene.widgets.map(map) }));
}

function mapAllThemes(project: Project, map: (theme: ThemeProject) => ThemeProject): Project {
  return {
    ...project,
    themeProjectGroups: project.themeProjectGroups.map((group) => ({
      ...group,
      themeProjects: group.themeProjects.map(map),
    })),
  };
}

function isMediaType(value: unknown): value is MediaType {
  return value === "image" || value === "video" || value === "audio";
}

/** Fits a geometry inside a Rotation's logical space without inverting it. */
function clampGeometry(geometry: Geometry, bounds: { width: number; height: number }): Geometry {
  if (!isValidGeometry(geometry)) return geometry;
  const width = Math.min(geometry.width, bounds.width);
  const height = Math.min(geometry.height, bounds.height);
  return {
    width,
    height,
    x: Math.min(Math.max(0, geometry.x), Math.max(0, bounds.width - width)),
    y: Math.min(Math.max(0, geometry.y), Math.max(0, bounds.height - height)),
  };
}

function normalizeAssetDraft(draft: AssetDraft): AssetDraft | undefined {
  const name = draft.name.trim();
  const sourcePath = draft.sourcePath.trim();
  if (name.length === 0 || sourcePath.length === 0) return undefined;
  // An absent media type is a legitimate resting state; a PRESENT but invalid
  // one is a programming error and is still refused.
  if (draft.mediaType !== undefined && !isMediaType(draft.mediaType)) return undefined;
  return { name, sourcePath, ...(draft.mediaType ? { mediaType: draft.mediaType } : {}), metadata: draft.metadata };
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

/** Rotation-aware copy placement: a copy may never land outside the display. */
function clampWidgetsToRotation(widgets: readonly Widget[], bounds: { readonly width: number; readonly height: number }): Widget[] {
  return widgets.map((widget) => ({ ...widget, geometry: clampGeometry(widget.geometry, bounds) }));
}

function duplicateScene(scene: Scene, collect?: string[]): Scene {
  const id = newId("scene");
  collect?.push(id);
  return {
    ...clone(scene),
    id,
    name: `${scene.name} Copy`,
    widgets: scene.widgets.map((widget) => duplicateWidget(widget)),
  };
}

function duplicateRotation(rotation: Rotation): Rotation {
  return {
    ...clone(rotation),
    id: newId("rotation"),
    scenes: rotation.scenes.map((scene) => duplicateScene(scene)),
  };
}

function duplicateThemeProject(theme: ThemeProject, collect?: string[]): ThemeProject {
  const id = newId("theme");
  collect?.push(id);
  return {
    ...clone(theme),
    id,
    name: `${theme.name} Copy`,
    rotations: theme.rotations.map(duplicateRotation),
  };
}

export class EditorApplication {
  constructor(readonly documents: InMemoryDocumentStore) {}

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

  addThemeProject(groupId: string, name = "New Theme Project", display?: DeviceProfile["display"]): MutationResult {
    const id = newId("theme");
    // Canonical shape (S2-05): when the DeviceProfile display is known, the
    // new Theme Project is born with exactly R0/R90/R180/R270 sourced from
    // the profile — a menu-created theme must be as valid as the scaffold.
    const rotations: Rotation[] = display && Number.isFinite(display.width) && Number.isFinite(display.height) && display.width > 0 && display.height > 0
      ? ([0, 90, 180, 270] as const).map((angle) => ({ id: newId("rotation"), angle, ...rotationDimensions(display, angle), scenes: [] }))
      : [];
    const result = this.execute(`Add Theme Project: ${name}`, (project) => mapProjectGroups(project, (group) => group.id === groupId ? {
      ...group,
      themeProjects: [...group.themeProjects, { id, name, rotations, resources: [] }],
    } : group));
    return result.changed ? { changed: true, createdIds: [id] } : result;
  }

  addScene(rotationId: string, name = "New Scene"): MutationResult {
    const id = newId("scene");
    const result = this.execute(`Add Scene: ${name}`, (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => rotation.id === rotationId ? {
      ...rotation,
      scenes: [...rotation.scenes, { id, name, widgets: [], priority: 0, activationConditions: [] }],
    } : rotation))));
    return result.changed ? { changed: true, createdIds: [id] } : result;
  }

  /**
   * Undoable, scene-scoped widget creation. Geometry is validated with the
   * same rules as every other geometry mutation; the widget is appended at
   * the top of the Scene's z-order (max zIndex + 1). Profile capability
   * filtering happens at the UI layer where the DeviceProfile lives.
   */
  addWidget(sceneId: string, widgetType: string, geometry?: Geometry, name?: string): MutationResult {
    const current = this.documents.getCurrent();
    if (!current || widgetType.trim().length === 0 || !findUniqueScene(current, sceneId)) return { changed: false };
    if (name !== undefined && name.trim().length === 0) return { changed: false };
    const base = geometry ?? { x: 0, y: 0, width: 120, height: 80 };
    if (!isValidGeometry(base)) return { changed: false };
    const id = newId("widget");
    const widgetName = name?.trim() || defaultWidgetName(widgetType);
    const result = this.execute(`Add Widget: ${widgetType}`, (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (scene) => {
      if (scene.id !== sceneId) return scene;
      const maxZ = scene.widgets.reduce((maximum, widget) => Math.max(maximum, widget.zIndex), 0);
      const widget: Widget = {
        id,
        name: widgetName,
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

  /**
   * Creates a sibling Theme Project Group. Without this the hierarchy had
   * exactly one group forever: the scaffold created it and no command could
   * add another, while delete refused to remove the last one.
   */
  addThemeProjectGroup(name = "New Theme Group"): MutationResult {
    const trimmed = name.trim();
    if (trimmed.length === 0) return { changed: false };
    const id = newId("theme-group");
    const result = this.execute(`Add Theme Group: ${trimmed}`, (project) => ({
      ...project,
      themeProjectGroups: [...project.themeProjectGroups, { id, name: trimmed, themeProjects: [] }],
    }));
    return result.changed ? { changed: true, createdIds: [id] } : result;
  }

  /**
   * Registers logical Asset records in the Project scope. One import is one
   * undoable command regardless of how many files the source produced. The
   * Core allocates every stable ID; import sources only supply the logical
   * record (name / sourcePath / mediaType / metadata), which is exactly what
   * the deployment package carries (`export.ts` asset records are logical,
   * `binary: false`).
   */
  addAssets(drafts: readonly AssetDraft[]): MutationResult {
    const current = this.documents.getCurrent();
    if (!current || drafts.length === 0) return { changed: false };
    const normalized = drafts.map(normalizeAssetDraft);
    if (normalized.some((draft) => draft === undefined)) return { changed: false };
    const accepted = normalized as readonly AssetDraft[];
    const created = accepted.map((draft) => ({ id: newId("asset"), ...draft } as Asset));
    const label = created.length === 1 ? `Import Asset: ${created[0].name}` : `Import ${created.length} Assets`;
    const result = this.execute(label, (project) => ({ ...project, assets: [...project.assets, ...clone(created)] }));
    return result.changed ? { changed: true, createdIds: created.map((asset) => asset.id) } : result;
  }

  setAssetProperties(assetId: string, patch: Partial<Pick<Asset, "name" | "sourcePath" | "mediaType" | "metadata">>): MutationResult {
    const current = this.documents.getCurrent();
    if (!current || !current.assets.some((asset) => asset.id === assetId)) return { changed: false };
    if (patch.name !== undefined && patch.name.trim().length === 0) return { changed: false };
    if (patch.sourcePath !== undefined && patch.sourcePath.trim().length === 0) return { changed: false };
    // `mediaType: undefined` clears the assignment, which is how a resource
    // returns to the unassigned state.
    if (patch.mediaType !== undefined && patch.mediaType !== null && !isMediaType(patch.mediaType)) return { changed: false };
    const cleanPatch: Partial<Asset> = {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.sourcePath !== undefined ? { sourcePath: patch.sourcePath.trim() } : {}),
      ...("mediaType" in patch ? { mediaType: patch.mediaType ?? undefined } : {}),
      ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
    };
    return this.execute("Edit Asset", (project) => ({
      ...project,
      assets: project.assets.map((asset) => asset.id === assetId ? { ...asset, ...clone(cleanPatch) } : asset),
    }));
  }

  /**
   * Deletes Assets and purges every reference to them in the same undoable
   * command. Leaving dangling references behind would produce
   * MISSING_REFERENCED_ASSET validation errors the user cannot repair, so the
   * canonical delete is reference-complete: Theme resources/defaults, Project
   * defaults, Widget assetIds/audioAssetId/mediaSlide and Binding contentId.
   */
  removeAssets(assetIds: readonly string[]): MutationResult {
    const current = this.documents.getCurrent();
    if (!current || !assetIds.length) return { changed: false };
    const removed = new Set(assetIds.filter((id) => current.assets.some((asset) => asset.id === id)));
    if (!removed.size) return { changed: false };
    const keepIds = (ids: readonly string[] | undefined) => ids?.filter((id) => !removed.has(id));
    const label = removed.size === 1 ? "Delete Asset" : `Delete ${removed.size} Assets`;
    return this.execute(label, (project) => {
      const withoutAssets: Project = {
        ...project,
        assets: project.assets.filter((asset) => !removed.has(asset.id)),
        ...(project.defaultAssetIds ? { defaultAssetIds: keepIds(project.defaultAssetIds) } : {}),
      };
      const withThemes = mapAllThemes(withoutAssets, (theme) => ({
        ...theme,
        resources: theme.resources.filter((id) => !removed.has(id)),
        ...(theme.defaultAssetIds ? { defaultAssetIds: keepIds(theme.defaultAssetIds) } : {}),
      }));
      return mapAllWidgets(withThemes, (widget) => {
        const slideBroken = Boolean(widget.mediaSlide && removed.has(widget.mediaSlide.assetId));
        return {
          ...widget,
          ...(widget.assetIds ? { assetIds: widget.assetIds.filter((id) => !removed.has(id)) } : {}),
          ...(widget.audioAssetId && removed.has(widget.audioAssetId) ? { audioAssetId: undefined } : {}),
          ...(widget.mediaSlide
            ? slideBroken
              ? { mediaSlide: undefined }
              : { mediaSlide: { ...widget.mediaSlide, ...(widget.mediaSlide.audioAssetId && removed.has(widget.mediaSlide.audioAssetId) ? { audioAssetId: undefined } : {}) } }
            : {}),
          bindings: widget.bindings.map((binding) => binding.contentId && removed.has(binding.contentId) ? { ...binding, contentId: undefined } : binding),
        };
      });
    });
  }

  /**
   * Replaces a Theme Project's resource list. `ThemeProject.resources` is the
   * canonical "ship this asset with the theme" declaration consumed by
   * `manifest.resourceAssetIds`; without an editor the export scope could
   * never contain anything.
   */
  setThemeResources(themeId: string, assetIds: readonly string[]): MutationResult {
    const current = this.documents.getCurrent();
    if (!current) return { changed: false };
    const known = new Set(current.assets.map((asset) => asset.id));
    if (!assetIds.every((id) => known.has(id)) || new Set(assetIds).size !== assetIds.length) return { changed: false };
    const themeExists = current.themeProjectGroups.some((group) => group.themeProjects.some((theme) => theme.id === themeId));
    if (!themeExists) return { changed: false };
    return this.execute("Edit Theme Resources", (project) => mapAllThemes(project, (theme) => theme.id === themeId ? { ...theme, resources: [...assetIds] } : theme));
  }

  /**
   * Type-specific Widget configuration: widgetType, media capability, asset
   * references and the free-form `content` / `style` records. Geometry, lock
   * and visibility keep their own commands. Changing `widgetType` clears the
   * previous type's `content` / `style` and any media-only fields, because
   * carrying a digit style on a text widget would be data the runtime and
   * validation must then reject.
   */
  setWidgetConfiguration(sceneId: string, widgetId: string, patch: WidgetConfigurationPatch): MutationResult {
    const current = this.documents.getCurrent();
    if (!current || !validScopedWidgetIds(current, sceneId, [widgetId])) return { changed: false };
    if (patch.widgetType !== undefined && patch.widgetType.trim().length === 0) return { changed: false };
    if (patch.mediaType !== undefined && patch.mediaType !== null && !isMediaType(patch.mediaType)) return { changed: false };
    const known = new Set(current.assets.map((asset) => asset.id));
    if (patch.assetIds !== undefined && !patch.assetIds.every((id) => known.has(id))) return { changed: false };
    if (patch.audioAssetId !== undefined && patch.audioAssetId !== undefined && patch.audioAssetId !== null && !known.has(patch.audioAssetId)) return { changed: false };
    if (patch.mediaSlide !== undefined && patch.mediaSlide !== null && !known.has(patch.mediaSlide.assetId)) return { changed: false };
    return this.execute("Edit Widget Configuration", (project) => mapAllScenes(project, (scene) => {
      if (scene.id !== sceneId) return scene;
      return mapWidgets(scene, (widget) => {
        if (widget.id !== widgetId) return widget;
        const nextType = patch.widgetType?.trim() ?? widget.widgetType;
        const typeChanged = nextType !== widget.widgetType;
        const base: Widget = typeChanged
          ? { ...widget, widgetType: nextType, content: undefined, style: undefined, mediaType: undefined, audioAssetId: undefined, mediaSlide: undefined }
          : widget;
        const applied: Widget = {
          ...base,
          ...(patch.mediaType !== undefined ? { mediaType: patch.mediaType ?? undefined } : {}),
          ...(patch.assetIds !== undefined ? { assetIds: [...patch.assetIds] } : {}),
          ...(patch.audioAssetId !== undefined ? { audioAssetId: patch.audioAssetId ?? undefined } : {}),
          ...(patch.mediaSlide !== undefined ? { mediaSlide: patch.mediaSlide ? clone(patch.mediaSlide) : undefined } : {}),
          ...(patch.content !== undefined ? { content: patch.content ? clone(patch.content) : undefined } : {}),
          ...(patch.style !== undefined ? { style: patch.style ? clone(patch.style) : undefined } : {}),
        };
        // A Media Slide is only valid on the media widget type, and audio is
        // only a Media/Media-Slide capability (validation.ts rules
        // MEDIA_SLIDE_WIDGET_TYPE_INVALID / AUDIO_BINDING_SCOPE_INVALID).
        const cleaned: Widget = applied.widgetType === "media"
          ? applied
          : { ...applied, mediaSlide: undefined, audioAssetId: applied.mediaSlide ? applied.audioAssetId : undefined };
        return cleaned;
      });
    }));
  }

  /**
   * Adopts the active DeviceProfile version, clearing a recorded drift. It is a
   * deliberate command rather than an automatic write: adopting means the
   * designer has reviewed the bindings the registry change may have affected.
   */
  adoptDeviceProfileVersion(version: string): MutationResult {
    if (version.trim().length === 0) return { changed: false };
    return this.execute(`Adopt DeviceProfile version ${version}`, (project) => ({ ...project, deviceProfileVersion: version }));
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

  setSceneProperties(sceneId: string, patch: Partial<Pick<Scene, "name" | "priority" | "enabled" | "activationConditionMode" | "activationConditions">>): MutationResult {
    if (patch.name !== undefined && patch.name.trim().length === 0) return { changed: false };
    if (patch.priority !== undefined && (!Number.isInteger(patch.priority) || patch.priority < 0 || patch.priority > 10)) return { changed: false };
    // Activation conditions decide which Scene the device shows; a condition
    // without a runtime reference could never evaluate, so it is refused here
    // rather than persisted for validation to report later.
    if (patch.activationConditions !== undefined && !patch.activationConditions.every((condition) => typeof condition.stateId === "string" && condition.stateId.trim().length > 0)) return { changed: false };
    const current = this.documents.getCurrent();
    if (!current || !findUniqueScene(current, sceneId)) return { changed: false };
    return this.execute("Edit Scene Properties", (project) => mapProjectGroups(project, (group) => mapThemeProjects(group, (theme) => mapRotations(theme, (rotation) => mapScenes(rotation, (scene) => scene.id === sceneId ? { ...scene, ...clone(patch), ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) } : scene)))));
  }

  /** Scene activation editor: replaces the activation rule in one undoable command. */
  setSceneActivation(sceneId: string, conditions: readonly Condition[], mode: Scene["activationConditionMode"]): MutationResult {
    return this.setSceneProperties(sceneId, { activationConditions: conditions, activationConditionMode: mode });
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
        return [widget, ...clampWidgetsToRotation([{ ...copy, geometry: { ...widget.geometry, x: widget.geometry.x + offset.x, y: widget.geometry.y + offset.y } }], rotation)];
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

  /**
   * Switching DeviceProfile is a geometry-contract change, not a label change.
   * Rotation dimensions are re-derived from the new display (with the R90/R270
   * swap) and every widget is clamped back inside its Rotation, so a profile
   * switch can never leave stale dimensions or stranded widgets behind. The
   * whole re-shape is one undoable command.
   */
  setProjectDeviceProfile(profileId: string, display?: DeviceProfile["display"], version?: string): MutationResult {
    if (profileId.trim().length === 0) return { changed: false };
    const usableDisplay = display && Number.isFinite(display.width) && Number.isFinite(display.height) && display.width > 0 && display.height > 0 ? display : undefined;
    return this.execute("Switch Device Profile", (project) => {
      const withProfile: Project = { ...project, deviceProfileId: profileId, ...(version !== undefined ? { deviceProfileVersion: version } : {}) };
      if (!usableDisplay) return withProfile;
      return {
        ...withProfile,
        themeProjectGroups: withProfile.themeProjectGroups.map((group) => ({
          ...group,
          themeProjects: group.themeProjects.map((theme) => ({
            ...theme,
            rotations: theme.rotations.map((rotation) => {
              const dimensions = rotationDimensions(usableDisplay, rotation.angle);
              return {
                ...rotation,
                ...dimensions,
                scenes: rotation.scenes.map((scene) => ({
                  ...scene,
                  widgets: scene.widgets.map((widget) => ({ ...widget, geometry: clampGeometry(widget.geometry, dimensions) })),
                })),
              };
            }),
          })),
        })),
      };
    });
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
      // Canonical invariant: a Theme Project contains exactly R0/R90/R180/R270
      // and there is deliberately no Add Rotation command, so deleting a
      // Rotation would leave a structurally invalid theme with no UI repair.
      if (containsRotationId(current, ids)) return { changed: false };
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
        // The +10/+10 copy offset must never push a copy off the display.
        return copyId ? [widget, ...clampWidgetsToRotation([duplicateWidget(widget, copyId)], rotation)] : [widget];
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
      const copies = clampWidgetsToRotation(templates.map((template, index) => ({
        ...duplicateWidget(template, copyIds[index]),
        zIndex: baseZ + 1 + index,
      })), rotation);
      return { ...scene, widgets: [...scene.widgets, ...copies] };
    })))));
    return result.changed ? { changed: true, createdIds: copyIds } : result;
  }

  duplicateSelection(ids: readonly string[]): MutationResult {    if (!ids.length) return { changed: false };
    const current = this.documents.getCurrent();
    const selected = new Set(ids);
    if (!current) return { changed: false };
    // Duplicating a Rotation would create a fifth Rotation/Form and break the
    // canonical exactly-four rule (validation REQUIRED_ROTATIONS_MISSING).
    if (containsRotationId(current, ids)) return { changed: false };
    const copyIds = buildDuplicateIdMap(current, selected);
    const widgetCopyIds = ids.filter((id) => copyIds.has(id)).map((id) => copyIds.get(id) as string);
    // Container copies allocate their ids inside the mutation, so they are
    // collected here: without them the caller could not select the copy it
    // just created and reported.
    const containerIds: string[] = [];
    const result = this.execute("Duplicate Selection", (project) => mapProjectGroups(project, (group) => {
      const themeProjects: ThemeProject[] = [];
      for (const theme of group.themeProjects) {
        if (selected.has(theme.id)) {
          themeProjects.push(theme, duplicateThemeProject(theme, containerIds));
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
              scenes.push(scene, duplicateScene(scene, containerIds));
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
    return result.changed ? { changed: true, createdIds: [...containerIds, ...widgetCopyIds] } : result;
  }
}

export function createEditorApplication(store: InMemoryDocumentStore): EditorApplication {
  return new EditorApplication(store);
}
