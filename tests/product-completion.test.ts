import { describe, expect, it } from "vitest";
import { InMemoryDocumentStore } from "../src/Core/document-store";
import { CommandHistory } from "../src/Core/commands";
import { createEditorApplication } from "../src/Core/editor-application";
import { buildDeploymentPackage } from "../src/Core/export";
import { selectActiveScene } from "../src/Core/runtime";
import { validateProject } from "../src/Core/validation";
import { compactDeviceProfile, createEmptyProject, foundationDeviceProfile } from "../src/Domain/factories";
import { LocalStorageProjectStorage, PROJECT_STORAGE_KEY } from "../src/Infrastructure/project-storage";
import { displayNameOf, extensionOf, inferMediaType, toAssetDraft } from "../src/Infrastructure/asset-import";
import { PROJECT_FILE_EXTENSION, parseProjectFile, projectFileName } from "../src/Infrastructure/project-file";
import type { Project, Widget } from "../src/Domain/models";

function widget(id: string, widgetType = "media", overrides: Partial<Widget> = {}): Widget {
  return {
    id,
    name: id,
    widgetType,
    enabled: true,
    visible: true,
    locked: false,
    geometry: { x: 10, y: 10, width: 100, height: 40 },
    zIndex: 1,
    bindings: [],
    assetIds: [],
    ...overrides,
  };
}

/** One Theme Project, canonical four rotations, one Scene with one widget in R0. */
function fixture(widgets: readonly Widget[] = [widget("w1")]): { project: Project; sceneId: string; themeId: string; rotationId: string } {
  const base = createEmptyProject("Completion Fixture");
  const theme = base.themeProjectGroups[0].themeProjects[0];
  const [first, ...rest] = theme.rotations;
  const sceneId = "scene-fixture";
  return {
    sceneId,
    themeId: theme.id,
    rotationId: first.id,
    project: {
      ...base,
      themeProjectGroups: [{
        ...base.themeProjectGroups[0],
        themeProjects: [{
          ...theme,
          rotations: [
            { ...first, scenes: [{ id: sceneId, name: "Scene Fixture", widgets: [...widgets], priority: 0, activationConditions: [] }] },
            ...rest,
          ],
        }],
      }],
    },
  };
}

function setup(project: Project, storage?: LocalStorageProjectStorage) {
  const store = new InMemoryDocumentStore(new CommandHistory(), storage);
  store.open(project);
  return { store, editor: createEditorApplication(store) };
}

function current(store: InMemoryDocumentStore): Project {
  const value = store.getCurrent();
  if (!value) throw new Error("no document");
  return value;
}

function firstScene(project: Project) {
  return project.themeProjectGroups[0].themeProjects[0].rotations[0].scenes[0];
}

class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null { return this.map.has(key) ? (this.map.get(key) as string) : null; }
  setItem(key: string, value: string): void { this.map.set(key, value); }
  removeItem(key: string): void { this.map.delete(key); }
}

describe("Asset lifecycle (L-01/D1-01)", () => {
  it("imports assets as one undoable command and refuses incomplete records", () => {
    const { project } = fixture();
    const { store, editor } = setup(project);
    expect(current(store).assets).toHaveLength(0);

    // An invalid draft must not create a partial import.
    expect(editor.addAssets([{ name: " ", sourcePath: "assets/a.png", mediaType: "image" }]).changed).toBe(false);
    expect(editor.addAssets([{ name: "A", sourcePath: "", mediaType: "image" }]).changed).toBe(false);
    expect(editor.addAssets([]).changed).toBe(false);
    expect(store.getSnapshot().history.undoCount).toBe(0);

    const result = editor.addAssets([
      { name: "Lobby", sourcePath: "assets/lobby.png", mediaType: "image" },
      { name: "Chime", sourcePath: "assets/chime.mp3", mediaType: "audio" },
    ]);
    expect(result.changed).toBe(true);
    expect(result.createdIds).toHaveLength(2);
    expect(current(store).assets.map((asset) => asset.name)).toEqual(["Lobby", "Chime"]);
    // Two files, ONE undo step.
    expect(store.getSnapshot().history.undoCount).toBe(1);
    expect(store.undo()).toBe(true);
    expect(current(store).assets).toHaveLength(0);
    expect(store.redo()).toBe(true);
    expect(current(store).assets).toHaveLength(2);
  });

  it("edits asset name, path and media type through the canonical pipeline", () => {
    const { project } = fixture();
    const { store, editor } = setup(project);
    const assetId = editor.addAssets([{ name: "Lobby", sourcePath: "assets/lobby.png", mediaType: "image" }]).createdIds?.[0] as string;

    expect(editor.setAssetProperties(assetId, { name: "  " }).changed).toBe(false);
    expect(editor.setAssetProperties(assetId, { sourcePath: "" }).changed).toBe(false);
    expect(editor.setAssetProperties("missing", { name: "x" }).changed).toBe(false);

    expect(editor.setAssetProperties(assetId, { name: "Lobby Loop", sourcePath: "assets/lobby-loop.png", mediaType: "video" }).changed).toBe(true);
    expect(current(store).assets[0]).toMatchObject({ name: "Lobby Loop", sourcePath: "assets/lobby-loop.png", mediaType: "video" });
    // Rename also works through the shared rename command.
    expect(editor.renameNode(assetId, "Lobby Final").changed).toBe(true);
    expect(current(store).assets[0].name).toBe("Lobby Final");
  });

  it("deleting an asset purges every reference so the project stays valid", () => {
    const { project, sceneId, themeId } = fixture([widget("w1", "media")]);
    const { store, editor } = setup(project);
    const imageId = editor.addAssets([{ name: "Lobby", sourcePath: "assets/lobby.png", mediaType: "image" }]).createdIds?.[0] as string;
    const audioId = editor.addAssets([{ name: "Chime", sourcePath: "assets/chime.mp3", mediaType: "audio" }]).createdIds?.[0] as string;

    expect(editor.setThemeResources(themeId, [imageId, audioId]).changed).toBe(true);
    expect(editor.setWidgetConfiguration(sceneId, "w1", {
      mediaType: "image",
      assetIds: [imageId],
      audioAssetId: audioId,
      mediaSlide: { mediaType: "image", assetId: imageId, duration: 4, audioAssetId: audioId },
    }).changed).toBe(true);
    expect(validateProject(current(store), foundationDeviceProfile).valid).toBe(true);

    expect(editor.removeAssets([imageId]).changed).toBe(true);
    const after = current(store);
    expect(after.assets.map((asset) => asset.id)).toEqual([audioId]);
    expect(after.themeProjectGroups[0].themeProjects[0].resources).toEqual([audioId]);
    const cleaned = firstScene(after).widgets[0];
    expect(cleaned.assetIds).toEqual([]);
    // The Media Slide required the removed asset, so the whole slide goes.
    expect(cleaned.mediaSlide).toBeUndefined();
    // No dangling reference survives, so no unfixable MISSING_REFERENCED_ASSET.
    const issues = validateProject(after, foundationDeviceProfile).issues;
    expect(issues.some((current) => current.code === "MISSING_REFERENCED_ASSET")).toBe(false);
    expect(store.undo()).toBe(true);
    expect(current(store).assets).toHaveLength(2);
  });

  it("reaches the deployment manifest once assets are referenced", async () => {
    const { project, sceneId, themeId } = fixture([widget("w1", "media")]);
    const { store, editor } = setup(project);
    const imageId = editor.addAssets([{ name: "Lobby", sourcePath: "assets/lobby.png", mediaType: "image" }]).createdIds?.[0] as string;
    editor.setThemeResources(themeId, [imageId]);
    editor.setWidgetConfiguration(sceneId, "w1", { mediaType: "image", assetIds: [imageId] });

    const built = await buildDeploymentPackage(current(store), foundationDeviceProfile);
    expect(built.manifest.resourceAssetIds).toEqual([imageId]);
    expect(built.manifest.usedAssetIds).toEqual([imageId]);
    expect(built.manifest.assetIds).toEqual([imageId]);
    expect(built.files.some((file) => file.kind === "asset" && file.assetId === imageId)).toBe(true);
    // A freshly built package is never pre-declared verified.
    expect(built.verified).toBe(false);
  });

  it("refuses theme resources that are not real assets", () => {
    const { project, themeId } = fixture();
    const { store, editor } = setup(project);
    expect(editor.setThemeResources(themeId, ["ghost"]).changed).toBe(false);
    const assetId = editor.addAssets([{ name: "A", sourcePath: "a.png", mediaType: "image" }]).createdIds?.[0] as string;
    expect(editor.setThemeResources(themeId, [assetId, assetId]).changed).toBe(false);
    expect(editor.setThemeResources("missing-theme", [assetId]).changed).toBe(false);
    expect(current(store).themeProjectGroups[0].themeProjects[0].resources).toEqual([]);
  });
});

describe("Widget configuration (L-06/L-07/D1-03)", () => {
  it("writes type-specific content and style through one undoable command", () => {
    const { project, sceneId } = fixture([widget("w1", "text")]);
    const { store, editor } = setup(project);
    expect(editor.setWidgetConfiguration(sceneId, "w1", { content: { text: "Lobby" } }).changed).toBe(true);
    expect(firstScene(current(store)).widgets[0].content).toEqual({ text: "Lobby" });
    expect(editor.setWidgetConfiguration(sceneId, "w1", { style: { digitStyleId: "digit-default" } }).changed).toBe(true);
    expect(firstScene(current(store)).widgets[0].style).toEqual({ digitStyleId: "digit-default" });
    expect(store.undo()).toBe(true);
    expect(firstScene(current(store)).widgets[0].style).toBeUndefined();
    expect(firstScene(current(store)).widgets[0].content).toEqual({ text: "Lobby" });
  });

  it("changing widgetType clears the previous type's configuration but keeps identity", () => {
    const { project, sceneId } = fixture([widget("w1", "media", {
      mediaType: "image",
      bindings: [{ id: "b1", widgetId: "w1", conditions: [{ stateId: "fire", operator: "equals", value: true }], action: "show" }],
      zIndex: 7,
    })]);
    const { store, editor } = setup(project);
    const assetId = editor.addAssets([{ name: "A", sourcePath: "a.png", mediaType: "image" }]).createdIds?.[0] as string;
    editor.setWidgetConfiguration(sceneId, "w1", { mediaSlide: { mediaType: "image", assetId, duration: 3 } });
    expect(firstScene(current(store)).widgets[0].mediaSlide).toBeDefined();

    expect(editor.setWidgetConfiguration(sceneId, "w1", { widgetType: "digit" }).changed).toBe(true);
    const changed = firstScene(current(store)).widgets[0];
    expect(changed.widgetType).toBe("digit");
    // Media-only data cannot survive on a digit widget or validation would reject it.
    expect(changed.mediaSlide).toBeUndefined();
    expect(changed.mediaType).toBeUndefined();
    expect(changed.audioAssetId).toBeUndefined();
    // Identity, geometry, z-order and bindings are preserved.
    expect(changed.id).toBe("w1");
    expect(changed.zIndex).toBe(7);
    expect(changed.geometry).toEqual({ x: 10, y: 10, width: 100, height: 40 });
    expect(changed.bindings).toHaveLength(1);
    expect(validateProject(current(store), foundationDeviceProfile).valid).toBe(true);
  });

  it("refuses configuration that references an unknown asset or an unscoped widget", () => {
    const { project, sceneId } = fixture([widget("w1", "media")]);
    const { store, editor } = setup(project);
    expect(editor.setWidgetConfiguration(sceneId, "w1", { assetIds: ["ghost"] }).changed).toBe(false);
    expect(editor.setWidgetConfiguration(sceneId, "w1", { audioAssetId: "ghost" }).changed).toBe(false);
    expect(editor.setWidgetConfiguration(sceneId, "w1", { mediaSlide: { mediaType: "image", assetId: "ghost", duration: 1 } }).changed).toBe(false);
    expect(editor.setWidgetConfiguration("missing-scene", "w1", { content: { text: "x" } }).changed).toBe(false);
    expect(editor.setWidgetConfiguration(sceneId, "missing", { content: { text: "x" } }).changed).toBe(false);
    expect(editor.setWidgetConfiguration(sceneId, "w1", { widgetType: "   " }).changed).toBe(false);
    expect(store.getSnapshot().history.undoCount).toBe(0);
  });

  it("keeps a Media Slide off non-media widget types", () => {
    const { project, sceneId } = fixture([widget("w1", "text")]);
    const { store, editor } = setup(project);
    const assetId = editor.addAssets([{ name: "A", sourcePath: "a.png", mediaType: "image" }]).createdIds?.[0] as string;
    editor.setWidgetConfiguration(sceneId, "w1", { mediaSlide: { mediaType: "image", assetId, duration: 2 } });
    expect(firstScene(current(store)).widgets[0].mediaSlide).toBeUndefined();
    expect(validateProject(current(store), foundationDeviceProfile).issues.some((issue) => issue.code === "MEDIA_SLIDE_WIDGET_TYPE_INVALID")).toBe(false);
  });
});

describe("Scene activation and navigation (L-12/L-13/D2-01)", () => {
  it("stores an activation rule the runtime actually honours", () => {
    const { project, sceneId, rotationId } = fixture();
    const { store, editor } = setup(project);
    expect(editor.addScene(rotationId, "Fire Scene").changed).toBe(true);
    const fireSceneId = firstRotation(current(store)).scenes[1].id;

    expect(editor.setSceneActivation(fireSceneId, [{ stateId: "fire", operator: "equals", value: true }], "all").changed).toBe(true);
    expect(editor.setSceneProperties(fireSceneId, { priority: 5 }).changed).toBe(true);

    const scenes = firstRotation(current(store)).scenes;
    // Without the state, the unconditional Scene wins.
    const idle = selectActiveScene(scenes, { values: {} }, foundationDeviceProfile);
    expect(idle.activeSceneId).toBe(sceneId);
    // With the state, the higher-priority conditional Scene takes over.
    const firing = selectActiveScene(scenes, { values: { fire: true } }, foundationDeviceProfile);
    expect(firing.activeSceneId).toBe(fireSceneId);

    expect(store.undo()).toBe(true);
    expect(store.undo()).toBe(true);
    expect(firstRotation(current(store)).scenes[1].activationConditions).toEqual([]);
  });

  it("refuses an activation condition without a runtime reference", () => {
    const { project, sceneId } = fixture();
    const { store, editor } = setup(project);
    expect(editor.setSceneActivation(sceneId, [{ stateId: "  ", operator: "equals", value: 1 }], "all").changed).toBe(false);
    expect(store.getSnapshot().history.undoCount).toBe(0);
  });

  it("reorders scenes, which is the simulator's activation-order tie-break", () => {
    const { project, rotationId } = fixture();
    const { store, editor } = setup(project);
    editor.addScene(rotationId, "Second");
    editor.addScene(rotationId, "Third");
    const before = firstRotation(current(store)).scenes.map((scene) => scene.name);
    expect(before).toEqual(["Scene Fixture", "Second", "Third"]);
    expect(editor.moveScene(rotationId, firstRotation(current(store)).scenes[2].id, 0).changed).toBe(true);
    expect(firstRotation(current(store)).scenes.map((scene) => scene.name)).toEqual(["Third", "Scene Fixture", "Second"]);
    expect(store.undo()).toBe(true);
    expect(firstRotation(current(store)).scenes.map((scene) => scene.name)).toEqual(before);
  });

  it("adds a Theme Project Group so the hierarchy is not frozen at one", () => {
    const { project } = fixture();
    const { store, editor } = setup(project);
    expect(editor.addThemeProjectGroup("  ").changed).toBe(false);
    expect(editor.addThemeProjectGroup("Secondary").changed).toBe(true);
    expect(current(store).themeProjectGroups.map((group) => group.name)).toEqual(["Untitled Theme Group", "Secondary"]);
    // With two groups, deleting one is allowed again.
    expect(editor.deleteSelection([current(store).themeProjectGroups[1].id]).changed).toBe(true);
    expect(current(store).themeProjectGroups).toHaveLength(1);
  });
});

function firstRotation(project: Project) {
  return project.themeProjectGroups[0].themeProjects[0].rotations[0];
}

describe("Device profile switching (L-18/D3-04)", () => {
  it("re-dimensions rotations, clamps widgets and stays undoable", () => {
    const { project } = fixture([widget("w1", "text", { geometry: { x: 600, y: 1100, width: 100, height: 100 } })]);
    const { store, editor } = setup(project);
    const before = structuredClone(current(store));
    expect(editor.setProjectDeviceProfile(compactDeviceProfile.id, compactDeviceProfile.display).changed).toBe(true);

    const after = current(store);
    expect(after.deviceProfileId).toBe(compactDeviceProfile.id);
    const rotations = after.themeProjectGroups[0].themeProjects[0].rotations;
    expect(rotations.map((rotation) => `${rotation.angle}:${rotation.width}x${rotation.height}`)).toEqual([
      "0:480x800", "90:800x480", "180:480x800", "270:800x480",
    ]);
    const clamped = firstScene(after).widgets[0].geometry;
    expect(clamped.x + clamped.width).toBeLessThanOrEqual(480);
    expect(clamped.y + clamped.height).toBeLessThanOrEqual(800);
    // The re-shape produces a valid project on the new profile.
    expect(validateProject(after, compactDeviceProfile).valid).toBe(true);
    expect(store.undo()).toBe(true);
    expect(current(store)).toEqual(before);
  });

  it("keeps the profile id alone when no display travels with it", () => {
    const { project } = fixture();
    const { store, editor } = setup(project);
    expect(editor.setProjectDeviceProfile("some-profile").changed).toBe(true);
    expect(current(store).themeProjectGroups[0].themeProjects[0].rotations[0].width).toBe(foundationDeviceProfile.display.width);
  });
});

describe("Validation completeness (D5-21)", () => {
  it("reports out-of-bounds widgets, empty scenes and duplicate names as warnings", () => {
    const { project } = fixture([
      widget("w1", "text", { geometry: { x: 700, y: 10, width: 200, height: 40 } }),
      widget("w2", "text", { name: "w1", geometry: { x: 0, y: 0, width: 40, height: 40 } }),
    ]);
    const result = validateProject(project, foundationDeviceProfile);
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain("WIDGET_OUTSIDE_SCENE_BOUNDS");
    expect(codes).toContain("DUPLICATE_WIDGET_NAME");
    // R90/R180/R270 have no Scene in the fixture.
    expect(codes).toContain("ROTATION_WITHOUT_SCENE");
    // Warnings must never block the build.
    expect(result.issues.filter((issue) => ["WIDGET_OUTSIDE_SCENE_BOUNDS", "DUPLICATE_WIDGET_NAME", "ROTATION_WITHOUT_SCENE"].includes(issue.code)).every((issue) => issue.severity === "warning")).toBe(true);
    expect(result.valid).toBe(true);
    // Every issue explains what, where and how to fix.
    expect(result.issues.every((issue) => Boolean(issue.code && issue.message && issue.path && issue.remediation))).toBe(true);
  });

  it("reports an empty scene and duplicate scene names", () => {
    const { project, rotationId } = fixture([]);
    const { store, editor } = setup(project);
    editor.addScene(rotationId, "Scene Fixture");
    const codes = validateProject(current(store), foundationDeviceProfile).issues.map((issue) => issue.code);
    expect(codes).toContain("SCENE_EMPTY");
    expect(codes).toContain("DUPLICATE_SCENE_NAME");
  });

  it("reports unresolvable widget styles and value sources", () => {
    const { project } = fixture([
      widget("w1", "digit", { style: { digitStyleId: "not-a-style" }, content: { sourceStateId: "not-a-state" } }),
    ]);
    const codes = validateProject(project, foundationDeviceProfile).issues.map((issue) => issue.code);
    expect(codes).toContain("UNKNOWN_DIGIT_STYLE");
    expect(codes).toContain("UNKNOWN_RUNTIME_REFERENCE");
  });

  it("accepts a digit widget configured from profile-declared values", () => {
    const { project } = fixture([
      widget("w1", "digit", { style: { digitStyleId: "digit-default" }, content: { sourceStateId: "floor" } }),
    ]);
    const codes = validateProject(project, foundationDeviceProfile).issues.map((issue) => issue.code);
    expect(codes).not.toContain("UNKNOWN_DIGIT_STYLE");
    expect(codes).not.toContain("UNKNOWN_RUNTIME_REFERENCE");
  });
});

describe("Asset import inference (browser transport)", () => {
  it("derives media type from MIME first and extension second", () => {
    expect(inferMediaType("lobby.png")).toBe("image");
    expect(inferMediaType("clip.mp4")).toBe("video");
    expect(inferMediaType("chime.MP3")).toBe("audio");
    expect(inferMediaType("data.bin", "video/webm")).toBe("video");
    expect(inferMediaType("notes.txt")).toBeUndefined();
    expect(extensionOf("a/b/c.JPEG")).toBe("jpeg");
    expect(displayNameOf("C:/media/Lobby Loop.png")).toBe("Lobby Loop");
  });

  it("records an honest source path and marks whether it is resolvable", () => {
    const relative = toAssetDraft({ name: "lobby.png", type: "image/png", size: 2048 }, { sourcePrefix: "assets" });
    expect(relative).toMatchObject({ name: "lobby", sourcePath: "assets/lobby.png", mediaType: "image" });
    expect(relative?.metadata?.resolvedPath).toBe(false);
    expect(relative?.metadata?.sizeBytes).toBe(2048);

    const native = toAssetDraft({ name: "lobby.png", type: "image/png", path: "D:/media/lobby.png" });
    expect(native?.sourcePath).toBe("D:/media/lobby.png");
    expect(native?.metadata?.resolvedPath).toBe(true);

    expect(toAssetDraft({ name: "readme.txt", type: "text/plain" })).toBeUndefined();
  });
});

describe("Project file gateway (L-19/D3-05)", () => {
  it("derives a safe file name and refuses documents that are not projects", () => {
    expect(projectFileName("My Lobby Template")).toBe(`my-lobby-template.${PROJECT_FILE_EXTENSION}`);
    expect(projectFileName("   ")).toBe(`template-designer-project.${PROJECT_FILE_EXTENSION}`);
    expect(parseProjectFile("{ not json")).toEqual({ ok: false, reason: "the file is not valid JSON" });
    expect(parseProjectFile(JSON.stringify({ id: "p", name: "n" }))).toMatchObject({ ok: false });
    const round = parseProjectFile(JSON.stringify(createEmptyProject("Round Trip")));
    expect(round.ok).toBe(true);
    if (round.ok) expect(round.project.name).toBe("Round Trip");
  });
});

describe("Persistence honesty (D3-02/D3-10)", () => {
  it("a new document actually reaches the storage slot", () => {
    const storage = new LocalStorageProjectStorage(new MemoryStorage());
    const first = createEmptyProject("First");
    storage.save(first);
    const store = new InMemoryDocumentStore(new CommandHistory(), storage);
    store.open(first);

    const second = createEmptyProject("Second");
    store.create(second);
    expect(store.getSnapshot().isDirty).toBe(false);
    // "Saved" must be true: a reload has to find the NEW project.
    expect(storage.load()?.name).toBe("Second");
  });

  it("an adopted (imported) document starts dirty", () => {
    const storage = new LocalStorageProjectStorage(new MemoryStorage());
    const store = new InMemoryDocumentStore(new CommandHistory(), storage);
    store.open(createEmptyProject("Persisted"));
    store.adopt(createEmptyProject("Imported"));
    expect(store.getSnapshot().isDirty).toBe(true);
    expect(store.getSnapshot().history.undoCount).toBe(0);
  });

  it("reports why a stored project was rejected and preserves the payload", () => {
    const raw = new MemoryStorage();
    const storage = new LocalStorageProjectStorage(raw);
    expect(storage.read()).toEqual({ status: "empty" });

    raw.setItem(PROJECT_STORAGE_KEY, "{ truncated");
    const broken = storage.read();
    expect(broken.status).toBe("rejected");
    if (broken.status === "rejected") {
      expect(broken.reason).toMatch(/JSON/);
      expect(broken.backupKey).toBe(`${PROJECT_STORAGE_KEY}.rejected`);
      expect(raw.getItem(broken.backupKey as string)).toBe("{ truncated");
    }

    raw.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ id: "p", name: "n", schemaVersion: 1, deviceProfileId: "d", themeProjectGroups: [{ id: "g" }], assets: [] }));
    const incomplete = storage.read();
    expect(incomplete.status).toBe("rejected");

    raw.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createEmptyProject("Good")));
    const loaded = storage.read();
    expect(loaded.status).toBe("loaded");
  });
});

describe("Second DeviceProfile is real (L-17)", () => {
  it("declares all four canonical rotations and its own capabilities", () => {
    expect(compactDeviceProfile.id).not.toBe(foundationDeviceProfile.id);
    expect(compactDeviceProfile.supportedRotations).toEqual([0, 90, 180, 270]);
    expect(compactDeviceProfile.display).not.toEqual(foundationDeviceProfile.display);
    expect(compactDeviceProfile.supportedMediaTypes).not.toContain("video");
    // A project created on it is born with correctly sized rotations.
    const created = createEmptyProject("Compact", compactDeviceProfile);
    expect(created.deviceProfileId).toBe(compactDeviceProfile.id);
    expect(created.themeProjectGroups[0].themeProjects[0].rotations.map((rotation) => rotation.width)).toEqual([480, 800, 480, 800]);
    expect(validateProject(created, compactDeviceProfile).issues.some((issue) => issue.severity === "error")).toBe(false);
  });
});

describe("Load gate rejects documents the editor cannot repair (D3-11/D3-12)", () => {
  it("refuses a project with duplicated widget or scene stable IDs", () => {
    const raw = new MemoryStorage();
    const storage = new LocalStorageProjectStorage(raw);

    const base = createEmptyProject("Duplicate IDs");
    const theme = base.themeProjectGroups[0].themeProjects[0];
    const [first, ...rest] = theme.rotations;
    const duplicated: Project = {
      ...base,
      themeProjectGroups: [{
        ...base.themeProjectGroups[0],
        themeProjects: [{
          ...theme,
          rotations: [
            { ...first, scenes: [{ id: "scene-1", name: "A", widgets: [widget("w1"), widget("w1")], priority: 0, activationConditions: [] }] },
            ...rest,
          ],
        }],
      }],
    };
    raw.setItem(PROJECT_STORAGE_KEY, JSON.stringify(duplicated));
    // Every scoped command refuses an id that appears twice, so the document
    // would render but never be editable.
    expect(storage.read().status).toBe("rejected");

    const duplicateScenes: Project = {
      ...duplicated,
      themeProjectGroups: [{
        ...duplicated.themeProjectGroups[0],
        themeProjects: [{
          ...duplicated.themeProjectGroups[0].themeProjects[0],
          rotations: duplicated.themeProjectGroups[0].themeProjects[0].rotations.map((rotation, index) => index === 0
            ? { ...rotation, scenes: [{ id: "scene-1", name: "A", widgets: [], priority: 0, activationConditions: [] }, { id: "scene-1", name: "B", widgets: [], priority: 0, activationConditions: [] }] }
            : rotation),
        }],
      }],
    };
    raw.setItem(PROJECT_STORAGE_KEY, JSON.stringify(duplicateScenes));
    expect(storage.read().status).toBe("rejected");

    // A structurally sound project with unique ids still loads.
    raw.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createEmptyProject("Sound")));
    expect(storage.read().status).toBe("loaded");
  });
});