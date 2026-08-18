import { describe, expect, it } from "vitest";
import { PackageDeploymentManager } from "../src/Core/application";
import { buildDeploymentPackage, verifyDeploymentPackage } from "../src/Core/export";
import { evaluateActiveSceneBindings, selectActiveScene } from "../src/Core/runtime";
import { validateProject } from "../src/Core/validation";
import type { DeviceProfile, Project, Scene, Widget } from "../src/Domain/models";

const profile: DeviceProfile = {
  id: "profile-test",
  name: "Test Display",
  display: { width: 720, height: 1280 },
  supportedRotations: [0, 90, 180, 270],
  supportedWidgetTypes: ["media", "digit", "direction", "warning", "text"],
  supportedMediaTypes: ["image", "video", "audio"],
  supportedFormats: ["png", "mp4", "wav"],
  runtimeStates: [
    { id: "floor", displayName: "Floor", type: "integer", category: "floor", operators: ["equals", "greater-than", "less-than"], simulator: true },
    { id: "fire", displayName: "Fire", type: "boolean", category: "warning", operators: ["equals"], simulator: true },
  ],
  runtimeSettings: [
    { id: "language", displayName: "Language", type: "enum", options: ["TR", "EN"], enumValues: ["TR", "EN"], operators: ["equals"], defaultValue: "TR", persistence: "persistent" },
  ],
  languages: ["TR", "EN"],
  digitStyles: ["digit-default"],
  directionStyles: ["direction-default"],
  audioCapabilities: { supportsBackgroundMusic: true, supportsAnnouncement: true, supportsMediaAudio: true, maxPriority: 100 },
  videoCapabilities: { maxConcurrentDecode: 2 },
};

const mediaAssets = [
  { id: "asset-logo", name: "Logo", sourcePath: "logo.png", mediaType: "image" as const },
  { id: "asset-used-video", name: "Fire Video", sourcePath: "fire.mp4", mediaType: "video" as const },
  { id: "asset-used-audio", name: "Fire Audio", sourcePath: "fire.wav", mediaType: "audio" as const },
  { id: "asset-default", name: "Default", sourcePath: "default.png", mediaType: "image" as const },
  { id: "asset-unused", name: "Unused", sourcePath: "unused.png", mediaType: "image" as const },
];

function mediaWidget(id: string, bindingCondition = "fire"): Widget {
  return {
    id,
    name: "Fire media",
    widgetType: "media",
    enabled: true,
    visible: true,
    locked: false,
    geometry: { x: 0, y: 0, width: 720, height: 1280 },
    zIndex: 10,
    bindings: [{
      id: `${id}-binding`,
      widgetId: id,
      conditions: [{ stateId: bindingCondition, operator: "equals", value: true }],
      action: "play",
      contentId: "asset-used-video",
    }],
    mediaSlide: {
      mediaType: "video",
      assetId: "asset-used-video",
      duration: 3,
      audioAssetId: "asset-used-audio",
      continuePlayback: true,
    },
  };
}

function scene(id: string, priority: number, widget?: Widget): Scene {
  return {
    id,
    name: id,
    priority,
    activationConditions: [],
    widgets: widget ? [widget] : [],
  };
}

function projectWithTheme(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-test",
    schemaVersion: 1,
    name: "Test Project",
    deviceProfileId: profile.id,
    themeProjectGroups: [{
      id: "group-test",
      name: "Themes",
      themeProjects: [{
        id: "theme-test",
        name: "Main Theme",
        resources: ["asset-logo"],
        defaultAssetIds: ["asset-default"],
        rotations: [
          { id: "r0", angle: 0, width: 720, height: 1280, scenes: [scene("normal", 1), scene("fire", 5, mediaWidget("fire-widget"))] },
          { id: "r90", angle: 90, width: 1280, height: 720, scenes: [] },
          { id: "r180", angle: 180, width: 720, height: 1280, scenes: [] },
          { id: "r270", angle: 270, width: 1280, height: 720, scenes: [] },
        ],
      }],
    }],
    assets: mediaAssets,
    metadata: {},
    ...overrides,
  };
}

describe("canonical runtime evaluation", () => {
  it("selects one active Scene, using priority and then later runtime activation order", () => {
    const scenes = [scene("first", 5), scene("second", 5), scene("higher", 8)];
    const context = { values: {}, sceneActivationOrder: { first: 3, second: 7, higher: 1 } };
    const result = selectActiveScene(scenes, context, profile);

    expect(result.activeSceneId).toBe("higher");
    expect(selectActiveScene(scenes.slice(0, 2), context, profile).activeSceneId).toBe("second");
  });

  it("evaluates bindings only inside the selected Scene", () => {
    const project = projectWithTheme();
    const rotation = project.themeProjectGroups[0]!.themeProjects[0]!.rotations[0]!;
    const result = selectActiveScene(rotation.scenes, { values: { fire: true } }, profile);
    const bindings = evaluateActiveSceneBindings(result.activeScene, { values: { fire: true } }, profile);

    expect(result.activeSceneId).toBe("fire");
    expect(bindings).toEqual([{ bindingId: "fire-widget-binding", widgetId: "fire-widget", matched: true, action: "play", contentId: "asset-used-video" }]);
  });
});

describe("canonical validation", () => {
  it("rejects unknown runtime states and invalid Scene priority", () => {
    const project = projectWithTheme();
    const invalid = {
      ...project,
      themeProjectGroups: [{
        ...project.themeProjectGroups[0]!,
        themeProjects: [{
          ...project.themeProjectGroups[0]!.themeProjects[0]!,
          rotations: project.themeProjectGroups[0]!.themeProjects[0]!.rotations.map((rotation, index) => index === 0 ? {
            ...rotation,
            scenes: [{
              ...rotation.scenes[0]!,
              priority: 11,
              activationConditions: [{ stateId: "custom_state", operator: "equals" as const, value: true }],
            }],
          } : rotation),
        }],
      }],
    };
    const result = validateProject(invalid, profile);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["SCENE_PRIORITY_INVALID", "UNKNOWN_RUNTIME_REFERENCE"]));
  });

  it("blocks unsupported semantic widget and broken media references", () => {
    const project = projectWithTheme({
      themeProjectGroups: [{
        ...projectWithTheme().themeProjectGroups[0]!,
        themeProjects: [{
          ...projectWithTheme().themeProjectGroups[0]!.themeProjects[0]!,
          rotations: projectWithTheme().themeProjectGroups[0]!.themeProjects[0]!.rotations.map((rotation, index) => index === 0 ? {
            ...rotation,
            scenes: [scene("invalid", 1, { ...mediaWidget("invalid-widget"), widgetType: "unsupported", mediaSlide: { mediaType: "video", assetId: "missing", duration: 3 } })],
          } : rotation),
        }],
      }],
    });
    const result = validateProject(project, profile);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["UNSUPPORTED_WIDGET_TYPE", "MISSING_REFERENCED_ASSET"]));
  });
});

describe("canonical deployment export", () => {
  it("hands only a verified package to the deployment adapter", async () => {
    let receivedVerified = false;
    const adapter = {
      target: { id: "sd-card", kind: "sd-card" as const, displayName: "SD Card" },
      async deploy(packageFile: Awaited<ReturnType<typeof buildDeploymentPackage>>): Promise<void> {
        receivedVerified = packageFile.verified;
      },
    };
    const manager = new PackageDeploymentManager(profile, adapter);

    await manager.deploy(projectWithTheme(), adapter.target);

    expect(receivedVerified).toBe(true);
  });


  it("exports only Resources + Used + Default assets and verifies integrity", async () => {
    const packageFile = await buildDeploymentPackage(projectWithTheme(), profile);
    const assetIds = packageFile.files.filter((file) => file.kind === "asset").map((file) => file.assetId);

    expect(assetIds).toEqual(["asset-default", "asset-logo", "asset-used-audio", "asset-used-video"]);
    expect(assetIds).not.toContain("asset-unused");
    expect(packageFile.manifest.assetIds).toEqual(assetIds);
    expect(packageFile.manifest).toMatchObject({ schemaVersion: 1 });
    // A freshly built package is never pre-declared verified.
    expect(packageFile.verified).toBe(false);
    expect((await verifyDeploymentPackage(packageFile)).verified).toBe(true);
    expect(packageFile.files.filter((file) => file.kind === "asset").every((file) => file.path.endsWith(".asset.json"))).toBe(true);

    const tampered = { ...packageFile, files: packageFile.files.map((file, index) => index === 0 ? { ...file, content: `${file.content}tampered` } : file) };
    expect((await verifyDeploymentPackage(tampered)).verified).toBe(false);
  });

  it("blocks build for a project without any Theme Project", async () => {
    const empty = {
      id: "project-empty",
      schemaVersion: 1,
      name: "Empty",
      deviceProfileId: profile.id,
      themeProjectGroups: [{ id: "group-empty", name: "Empty Group", themeProjects: [] }],
      assets: [],
      metadata: {},
    };
    const validation = validateProject(empty, profile);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain("THEME_PROJECT_REQUIRED");
    await expect(buildDeploymentPackage(empty, profile)).rejects.toThrow("Export is blocked");
  });

  it("flags duplicated widget ids, non-finite zIndex and decode-slot violations", () => {
    const base = projectWithTheme();
    const duplicatedWidget = mediaWidget("fire-widget");
    const duplicated: Project = {
      ...base,
      themeProjectGroups: [{
        ...base.themeProjectGroups[0]!,
        themeProjects: [{
          ...base.themeProjectGroups[0]!.themeProjects[0]!,
          rotations: base.themeProjectGroups[0]!.themeProjects[0]!.rotations.map((rotation) => rotation.id === "r0" ? {
            ...rotation,
            scenes: [...rotation.scenes, { id: "dup", name: "dup", priority: 1, activationConditions: [], widgets: [duplicatedWidget] }],
          } : rotation),
        }],
      }],
    };
    const duplicateResult = validateProject(duplicated, profile);
    expect(duplicateResult.issues.map((issue) => issue.code)).toContain("DUPLICATE_WIDGET_ID");

    const badZ = projectWithTheme({
      themeProjectGroups: [{
        ...projectWithTheme().themeProjectGroups[0]!,
        themeProjects: [{
          ...projectWithTheme().themeProjectGroups[0]!.themeProjects[0]!,
          rotations: projectWithTheme().themeProjectGroups[0]!.themeProjects[0]!.rotations.map((rotation) => rotation.id === "r0" ? {
            ...rotation,
            scenes: [scene("badz", 1, { ...mediaWidget("badz"), zIndex: Number.NaN })],
          } : rotation),
        }],
      }],
    });
    expect(validateProject(badZ, profile).issues.map((issue) => issue.code)).toContain("WIDGET_Z_INDEX_INVALID");

    const threeVideos: Project = {
      ...base,
      themeProjectGroups: [{
        ...base.themeProjectGroups[0]!,
        themeProjects: [{
          ...base.themeProjectGroups[0]!.themeProjects[0]!,
          rotations: base.themeProjectGroups[0]!.themeProjects[0]!.rotations.map((rotation) => rotation.id === "r0" ? {
            ...rotation,
            scenes: [{ id: "videos", name: "videos", priority: 1, activationConditions: [], widgets: [mediaWidget("v1"), mediaWidget("v2"), mediaWidget("v3")] }],
          } : rotation),
        }],
      }],
    };
    expect(validateProject(threeVideos, profile).issues.map((issue) => issue.code)).toContain("VIDEO_SLOT_LIMIT_EXCEEDED");
  });
});
