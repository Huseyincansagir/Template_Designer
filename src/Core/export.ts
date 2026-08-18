import type {
  Asset,
  DeploymentFile,
  DeploymentPackage,
  DeviceProfile,
  Project,
  ThemeProject,
  Widget,
} from "../Domain/models";
import { stableSerialize } from "./serialize";
import { validateProject, type ValidationResult } from "./validation";

export class ExportBlockedError extends Error {
  constructor(public readonly validation: ValidationResult) {
    super("Export is blocked because the project has validation errors.");
    this.name = "ExportBlockedError";
  }
}

function collectNestedAssetIds(value: unknown, result: Set<string>): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectNestedAssetIds(item, result));
    return;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
    const normalized = key.toLowerCase();
    if (normalized === "assetid" && typeof nested === "string") result.add(nested);
    if (normalized === "assetids" && Array.isArray(nested)) nested.filter((item): item is string => typeof item === "string").forEach((id) => result.add(id));
    collectNestedAssetIds(nested, result);
  });
}

function collectWidgetAssetIds(widget: Widget, result: Set<string>): void {
  widget.assetIds?.forEach((assetId) => result.add(assetId));
  if (widget.audioAssetId) result.add(widget.audioAssetId);
  if (widget.mediaSlide) {
    result.add(widget.mediaSlide.assetId);
    if (widget.mediaSlide.audioAssetId) result.add(widget.mediaSlide.audioAssetId);
  }
  widget.bindings.forEach((binding) => {
    if (binding.contentId) result.add(binding.contentId);
  });
  collectNestedAssetIds(widget.content, result);
  collectNestedAssetIds(widget.style, result);
}

function collectUsedAssetIds(project: Project): Set<string> {
  const result = new Set<string>();
  project.themeProjectGroups.forEach((group) => {
    group.themeProjects.forEach((theme) => {
      theme.rotations.forEach((rotation) => rotation.scenes.forEach((scene) => scene.widgets.forEach((widget) => collectWidgetAssetIds(widget, result))));
    });
  });
  return result;
}

function collectDefaultAssetIds(project: Project, profile: DeviceProfile): Set<string> {
  const result = new Set<string>([
    ...(project.defaultAssetIds ?? []),
    ...(profile.defaultAssetIds ?? []),
  ]);
  project.themeProjectGroups.forEach((group) => group.themeProjects.forEach((theme) => theme.defaultAssetIds?.forEach((assetId) => result.add(assetId))));
  return result;
}

function collectResourceAssetIds(project: Project): Set<string> {
  const result = new Set<string>();
  project.themeProjectGroups.forEach((group) => group.themeProjects.forEach((theme) => theme.resources.forEach((assetId) => result.add(assetId))));
  return result;
}

function assetFile(asset: Asset): DeploymentFile {
  return {
    // The V1 package carries a normalized logical asset record, NOT binary
    // media bytes. Binary materialization belongs to the platform/deployment
    // adapter (AGENTS.md package boundary). The record is deliberately
    // labelled `.asset.json` so it can never be mistaken for media content,
    // and it declares `binary: false`.
    path: `assets/${asset.id}.asset.json`,
    kind: "asset",
    assetId: asset.id,
    content: stableSerialize({
      id: asset.id,
      name: asset.name,
      mediaType: asset.mediaType,
      sourcePath: asset.sourcePath,
      metadata: asset.metadata ?? {},
      binary: false,
    }),
  };
}

function themeFiles(theme: ThemeProject): readonly DeploymentFile[] {
  const themeFile: DeploymentFile = {
    path: `themes/${theme.id}/theme.json`,
    kind: "theme",
    content: stableSerialize({
      id: theme.id,
      name: theme.name,
      resources: [...theme.resources].sort(),
      defaultAssetIds: [...(theme.defaultAssetIds ?? [])].sort(),
      floorMappings: theme.floorMappings ?? [],
      themeDefaults: theme.themeDefaults ?? {},
    }),
  };
  const layoutFiles = theme.rotations.map((rotation): DeploymentFile => ({
    path: `themes/${theme.id}/rotations/${rotation.id}.json`,
    kind: "layout",
    content: stableSerialize(rotation),
  }));
  return [themeFile, ...layoutFiles];
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function checksumFiles(files: readonly DeploymentFile[]): Promise<string> {
  const canonical = files.map((file) => `${file.path}\n${file.content}`).join("\n");
  return sha256(canonical);
}

export async function buildDeploymentPackage(
  project: Project,
  profile: DeviceProfile,
): Promise<DeploymentPackage> {
  const validation = validateProject(project, profile);
  if (!validation.valid) throw new ExportBlockedError(validation);

  const resources = collectResourceAssetIds(project);
  const used = collectUsedAssetIds(project);
  const defaults = collectDefaultAssetIds(project, profile);
  const includedAssetIds = new Set([...resources, ...used, ...defaults]);
  const assetsById = new Map(project.assets.map((asset) => [asset.id, asset]));
  const themes = project.themeProjectGroups.flatMap((group) => group.themeProjects);

  const manifest = {
    schemaVersion: project.schemaVersion,
    packageId: `package-${project.id}-${project.schemaVersion}`,
    packageVersion: project.schemaVersion,
    projectId: project.id,
    projectName: project.name,
    deviceProfileId: profile.id,
    themeProjectIds: themes.map((theme) => theme.id).sort(),
    resourceAssetIds: [...resources].sort(),
    usedAssetIds: [...used].sort(),
    defaultAssetIds: [...defaults].sort(),
    assetIds: [...includedAssetIds].sort(),
  };

  const manifestFile: DeploymentFile = {
    path: "manifest.json",
    kind: "manifest",
    content: stableSerialize(manifest),
  };
  const files = [
    manifestFile,
    ...themes.flatMap((theme) => themeFiles(theme)),
    ...[...includedAssetIds].sort().map((assetId) => assetsById.get(assetId)).filter((asset): asset is Asset => Boolean(asset)).map(assetFile),
  ];
  const integrity = {
    algorithm: "sha256" as const,
    checksum: await checksumFiles(files),
  };

  return {
    id: manifest.packageId,
    schemaVersion: project.schemaVersion,
    manifest,
    files,
    projectId: project.id,
    integrity,
    // A freshly built package is NEVER pre-declared verified. Verification
    // is a separate step (verifyDeploymentPackage) and, for real targets, a
    // read-back comparison after writing (AGENTS.md: never claim success
    // before verification completes).
    verified: false,
  };
}

export async function verifyDeploymentPackage(
  packageFile: DeploymentPackage,
): Promise<DeploymentPackage> {
  const checksum = await checksumFiles(packageFile.files);
  return {
    ...packageFile,
    verified: packageFile.integrity.algorithm === "sha256" && checksum === packageFile.integrity.checksum,
  };
}
