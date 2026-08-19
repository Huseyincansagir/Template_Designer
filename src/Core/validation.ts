import type {
  Asset,
  Binding,
  Condition,
  DeviceProfile,
  FloorMapping,
  Project,
  RuntimeStateDefinition,
  RuntimeSettingDefinition,
  Scene,
  ThemeProject,
  Widget,
} from "../Domain/models";

export type ValidationSeverity = "info" | "warning" | "error";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  path?: string;
  remediation?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: readonly ValidationIssue[];
}

function issue(
  issues: ValidationIssue[],
  code: string,
  message: string,
  path: string,
  remediation: string,
  severity: ValidationSeverity = "error",
): void {
  issues.push({ severity, code, message, path, remediation });
}

function uniqueIds(values: readonly { id: string }[]): readonly string[] {
  return values.filter((value, index) => values.findIndex((candidate) => candidate.id === value.id) === index).map((value) => value.id);
}

function validateCondition(
  condition: Condition,
  profile: DeviceProfile,
  path: string,
  issues: ValidationIssue[],
): void {
  const source = condition.source ?? "state";
  const definitions = source === "setting" ? profile.runtimeSettings : profile.runtimeStates;
  const definition = definitions.find((candidate) => candidate.id === condition.stateId);

  if (!definition) {
    issue(
      issues,
      "UNKNOWN_RUNTIME_REFERENCE",
      `Runtime ${source} '${condition.stateId}' is not defined by the active DeviceProfile.`,
      path,
      "Select a DeviceProfile-defined runtime state/setting or remove the unresolved condition.",
    );
    return;
  }

  if (definition.operators && !definition.operators.includes(condition.operator)) {
    issue(
      issues,
      "UNSUPPORTED_CONDITION_OPERATOR",
      `Operator '${condition.operator}' is not supported for runtime reference '${condition.stateId}'.`,
      path,
      "Choose one of the operators declared by the active DeviceProfile.",
    );
  }

  const typeValid =
    definition.type === "boolean"
      ? typeof condition.value === "boolean"
      : definition.type === "integer"
        ? typeof condition.value === "number" && Number.isInteger(condition.value)
        : definition.type === "number"
          ? typeof condition.value === "number" && Number.isFinite(condition.value)
          : typeof condition.value === "string";

  if (!typeValid) {
    issue(
      issues,
      "INVALID_CONDITION_DATATYPE",
      `Condition value for '${condition.stateId}' does not match its DeviceProfile type '${definition.type}'.`,
      path,
      "Use a value compatible with the runtime registry definition.",
    );
  }

  if (definition.type === "enum" && definition.enumValues && typeof condition.value === "string" && !definition.enumValues.includes(condition.value)) {
    issue(
      issues,
      "INVALID_CONDITION_VALUE",
      `Value '${condition.value}' is not allowed for enum '${condition.stateId}'.`,
      path,
      "Select one of the values declared by the active DeviceProfile.",
    );
  }
}

function validateBinding(
  binding: Binding,
  widget: Widget,
  profile: DeviceProfile,
  assetIds: ReadonlySet<string>,
  path: string,
  issues: ValidationIssue[],
): void {
  if (binding.widgetId !== widget.id) {
    issue(issues, "BINDING_WIDGET_MISMATCH", "Binding widgetId must match its owning widget.", path, "Rebind the condition to the owning widget.");
  }

  if (binding.conditions.length === 0) {
    issue(issues, "BINDING_CONDITION_REQUIRED", "A binding requires at least one condition.", path, "Add a DeviceProfile-defined condition or remove the binding.");
  }

  binding.conditions.forEach((condition, index) => validateCondition(condition, profile, `${path}.conditions[${index}]`, issues));

  if (binding.contentId && !assetIds.has(binding.contentId)) {
    issue(issues, "BROKEN_BINDING_CONTENT_REFERENCE", `Binding content '${binding.contentId}' cannot be resolved.`, `${path}.contentId`, "Import or select the referenced asset.");
  }
}

function validateAssetReference(
  assetId: string,
  assets: ReadonlyMap<string, Asset>,
  path: string,
  issues: ValidationIssue[],
): void {
  const asset = assets.get(assetId);
  if (!asset) {
    issue(issues, "MISSING_REFERENCED_ASSET", `Asset '${assetId}' cannot be resolved.`, path, "Import the asset or remove the broken reference.");
    return;
  }
  if (!asset.mediaType) {
    // Referencing a typeless asset would put a record with no media type into
    // the deployment package, so this one blocks.
    issue(issues, "REFERENCED_ASSET_TYPE_UNASSIGNED", `Asset '${asset.name}' is referenced but has no media type.`, path, "Assign a media type to the asset, or remove the reference.");
  }
}

function validateWidget(
  widget: Widget,
  profile: DeviceProfile,
  assets: ReadonlyMap<string, Asset>,
  path: string,
  issues: ValidationIssue[],
  bounds?: { readonly width: number; readonly height: number },
): void {
  const assetIds = new Set(assets.keys());

  if (!profile.supportedWidgetTypes.includes(widget.widgetType)) {
    issue(issues, "UNSUPPORTED_WIDGET_TYPE", `Widget type '${widget.widgetType}' is not supported by the active DeviceProfile.`, `${path}.widgetType`, "Choose a supported widget type or switch DeviceProfile.");
  }

  // Defense in depth (S5-04): malformed persisted data must surface as a
  // validation issue, never as a render-phase crash.
  if (!widget.geometry || !Number.isFinite(widget.geometry.x) || !Number.isFinite(widget.geometry.y) || !Number.isFinite(widget.geometry.width) || !Number.isFinite(widget.geometry.height)) {
    issue(issues, "INVALID_WIDGET_GEOMETRY", "Widget geometry must contain finite x/y/width/height values.", `${path}.geometry`, "Restore or re-create the widget geometry.");
    return;
  }

  if (widget.geometry.width <= 0 || widget.geometry.height <= 0) {
    issue(issues, "INVALID_WIDGET_GEOMETRY", "Widget width and height must be greater than zero.", `${path}.geometry`, "Set positive width and height values.");
  }

  if (!Number.isFinite(widget.zIndex)) {
    issue(issues, "WIDGET_Z_INDEX_INVALID", "Widget zIndex must be a finite number.", `${path}.zIndex`, "Assign a finite zIndex value.");
  }

  // A widget outside its Rotation's logical space exists in the document but
  // can never be seen on the device.
  if (bounds && bounds.width > 0 && bounds.height > 0) {
    const overflowsRight = widget.geometry.x + widget.geometry.width > bounds.width;
    const overflowsBottom = widget.geometry.y + widget.geometry.height > bounds.height;
    if (widget.geometry.x < 0 || widget.geometry.y < 0 || overflowsRight || overflowsBottom) {
      issue(
        issues,
        "WIDGET_OUTSIDE_SCENE_BOUNDS",
        `Widget '${widget.name}' extends outside the ${bounds.width} x ${bounds.height} display area and would be clipped.`,
        `${path}.geometry`,
        "Move or resize the widget so it fits inside the Rotation / Form display area.",
        "warning",
      );
    }
  }

  // A declared style that the profile does not provide falls back silently at
  // runtime; the designer must be told which style will actually be used.
  const digitStyleId = widget.style?.digitStyleId;
  if (widget.widgetType === "digit" && typeof digitStyleId === "string" && digitStyleId.length > 0 && profile.digitStyles && !profile.digitStyles.includes(digitStyleId)) {
    issue(issues, "UNKNOWN_DIGIT_STYLE", `Digit style '${digitStyleId}' is not provided by the active DeviceProfile.`, `${path}.style.digitStyleId`, `Select a profile-defined Digit Style${profile.defaultDigitStyleId ? ` (default: ${profile.defaultDigitStyleId})` : ""}.`);
  }
  const directionStyleId = widget.style?.directionStyleId;
  if (widget.widgetType === "direction" && typeof directionStyleId === "string" && directionStyleId.length > 0 && profile.directionStyles && !profile.directionStyles.includes(directionStyleId)) {
    issue(issues, "UNKNOWN_DIRECTION_STYLE", `Direction style '${directionStyleId}' is not provided by the active DeviceProfile.`, `${path}.style.directionStyleId`, "Select a profile-defined Direction Style.");
  }

  // A content value source must exist in the runtime registry, otherwise the
  // widget can never display a value.
  const sourceStateId = widget.content?.sourceStateId;
  if (typeof sourceStateId === "string" && sourceStateId.length > 0 && !profile.runtimeStates.some((state) => state.id === sourceStateId)) {
    issue(issues, "UNKNOWN_RUNTIME_REFERENCE", `Widget value source '${sourceStateId}' is not defined by the active DeviceProfile.`, `${path}.content.sourceStateId`, "Select a DeviceProfile-defined runtime state or clear the value source.");
  }

  if (widget.mediaType && !profile.supportedMediaTypes.includes(widget.mediaType)) {
    issue(issues, "UNSUPPORTED_MEDIA_TYPE", `Media type '${widget.mediaType}' is not supported by the active DeviceProfile.`, `${path}.mediaType`, "Choose a supported media type.");
  }

  (Array.isArray(widget.assetIds) ? widget.assetIds : []).forEach((assetId, index) => validateAssetReference(assetId, assets, `${path}.assetIds[${index}]`, issues));

  if (widget.audioAssetId) {
    const audioAsset = assets.get(widget.audioAssetId);
    if (widget.widgetType !== "media" && !widget.mediaSlide) {
      issue(issues, "AUDIO_BINDING_SCOPE_INVALID", "Audio is not a generic capability of every semantic widget.", `${path}.audioAssetId`, "Use audio through Media/Media Slide or the audio policy boundary.");
    }
    validateAssetReference(widget.audioAssetId, assets, `${path}.audioAssetId`, issues);
    if (audioAsset && audioAsset.mediaType !== "audio") {
      issue(issues, "AUDIO_ASSET_TYPE_INVALID", `Asset '${widget.audioAssetId}' is not an audio asset.`, `${path}.audioAssetId`, "Select an asset with mediaType 'audio'.");
    }
  }

  if (widget.mediaSlide) {
    if (widget.widgetType !== "media") {
      issue(issues, "MEDIA_SLIDE_WIDGET_TYPE_INVALID", "Media Slide must use the Media semantic widget type.", `${path}.mediaSlide`, "Use widgetType 'media' for a Media Slide.");
    }
    if (!profile.supportedMediaTypes.includes(widget.mediaSlide.mediaType)) {
      issue(issues, "MEDIA_SLIDE_MEDIA_UNSUPPORTED", `Media Slide type '${widget.mediaSlide.mediaType}' is not supported by the active DeviceProfile.`, `${path}.mediaSlide.mediaType`, "Choose a supported image or video capability.");
    }
    if (widget.mediaSlide.duration < 0 || !Number.isFinite(widget.mediaSlide.duration)) {
      issue(issues, "MEDIA_DURATION_INVALID", "Media duration cannot be negative or non-finite.", `${path}.mediaSlide.duration`, "Use duration 0 or a finite non-negative duration in 0.1 second precision.");
    }
    if (widget.mediaSlide.duration * 10 !== Math.trunc(widget.mediaSlide.duration * 10)) {
      issue(issues, "MEDIA_DURATION_PRECISION_INVALID", "Media duration must use 0.1 second precision.", `${path}.mediaSlide.duration`, "Round the duration to one decimal place.");
    }
    if (widget.mediaSlide.repeatCount !== undefined && (!Number.isInteger(widget.mediaSlide.repeatCount) || widget.mediaSlide.repeatCount < 0)) {
      issue(issues, "MEDIA_REPEAT_COUNT_INVALID", "Media repeat count must be a non-negative integer.", `${path}.mediaSlide.repeatCount`, "Use a non-negative integer repeat count.");
    }
    validateAssetReference(widget.mediaSlide.assetId, assets, `${path}.mediaSlide.assetId`, issues);
    const visualAsset = assets.get(widget.mediaSlide.assetId);
    if (visualAsset && visualAsset.mediaType !== widget.mediaSlide.mediaType) {
      issue(issues, "MEDIA_ASSET_TYPE_INVALID", `Asset '${widget.mediaSlide.assetId}' does not match Media Slide type '${widget.mediaSlide.mediaType}'.`, `${path}.mediaSlide.assetId`, "Select an asset with the same media type as the Media Slide.");
    }
    if (widget.mediaSlide.audioAssetId) {
      validateAssetReference(widget.mediaSlide.audioAssetId, assets, `${path}.mediaSlide.audioAssetId`, issues);
      const audioAsset = assets.get(widget.mediaSlide.audioAssetId);
      if (audioAsset && audioAsset.mediaType !== "audio") {
        issue(issues, "MEDIA_SLIDE_AUDIO_TYPE_INVALID", `Asset '${widget.mediaSlide.audioAssetId}' is not an audio asset.`, `${path}.mediaSlide.audioAssetId`, "Select an audio asset for the attached Media Slide audio.");
      }
    }
  }

  (Array.isArray(widget.bindings) ? widget.bindings : []).forEach((binding, index) => validateBinding(binding, widget, profile, assetIds, `${path}.bindings[${index}]`, issues));
}

function validateScene(
  scene: Scene,
  profile: DeviceProfile,
  assets: ReadonlyMap<string, Asset>,
  path: string,
  issues: ValidationIssue[],
  bounds?: { readonly width: number; readonly height: number },
): void {
  if (scene.priority < 0 || scene.priority > 10 || !Number.isInteger(scene.priority)) {
    issue(issues, "SCENE_PRIORITY_INVALID", "Scene priority must be an integer from 0 through 10.", `${path}.priority`, "Set a Scene priority between 0 and 10.");
  }

  // An empty Scene is legal but never shows anything; the designer should know
  // before the package is built.
  if ((Array.isArray(scene.widgets) ? scene.widgets : []).length === 0) {
    issue(issues, "SCENE_EMPTY", `Scene '${scene.name}' contains no widget and would render an empty display.`, `${path}.widgets`, "Add at least one widget, or delete the Scene.", "warning");
  }

  (Array.isArray(scene.activationConditions) ? scene.activationConditions : []).forEach((condition, index) => validateCondition(condition, profile, `${path}.activationConditions[${index}]`, issues));
  (Array.isArray(scene.widgets) ? scene.widgets : []).forEach((widget, index) => validateWidget(widget, profile, assets, `${path}.widgets[${index}]`, issues, bounds));

  const duplicateNames = new Set<string>();
  const seenNames = new Set<string>();
  (Array.isArray(scene.widgets) ? scene.widgets : []).forEach((widget) => {
    const key = widget.name.trim().toLowerCase();
    if (seenNames.has(key)) duplicateNames.add(widget.name.trim());
    seenNames.add(key);
  });
  duplicateNames.forEach((name) => issue(issues, "DUPLICATE_WIDGET_NAME", `Scene '${scene.name}' has more than one widget named '${name}'.`, `${path}.widgets`, "Rename one of them so runtime traces and the Explorer stay unambiguous.", "warning"));

  const maxConcurrentDecode = profile.videoCapabilities?.maxConcurrentDecode;
  if (maxConcurrentDecode !== undefined && maxConcurrentDecode > 0) {
    const videoWidgets = scene.widgets.filter((widget) => widget.mediaType === "video" || widget.mediaSlide?.mediaType === "video");
    if (videoWidgets.length > maxConcurrentDecode) {
      issue(
        issues,
        "VIDEO_SLOT_LIMIT_EXCEEDED",
        `Scene uses ${videoWidgets.length} video widgets but the active DeviceProfile allows ${maxConcurrentDecode} concurrent decode slot(s).`,
        `${path}.widgets`,
        "Remove excess video widgets or reduce the Scene to the profile's concurrent decode capability.",
      );
    }
  }
}

function validateFloorMapping(
  mapping: FloorMapping,
  profile: DeviceProfile,
  assetIds: ReadonlySet<string>,
  path: string,
  issues: ValidationIssue[],
): void {
  const seen = new Set<string>();
  mapping.entries.forEach((entry, index) => {
    const key = `${typeof entry.firmwareValue}:${String(entry.firmwareValue)}`;
    if (seen.has(key)) {
      issue(issues, "DUPLICATE_FLOOR_MAPPING", `Firmware floor value '${entry.firmwareValue}' is mapped more than once.`, `${path}.entries[${index}]`, "Keep one deterministic display mapping per firmware value.");
    }
    seen.add(key);
    if (entry.digitStyleId && !profile.digitStyles?.includes(entry.digitStyleId)) {
      issue(issues, "UNKNOWN_DIGIT_STYLE", `Digit style '${entry.digitStyleId}' is not provided by the active DeviceProfile.`, `${path}.entries[${index}].digitStyleId`, "Select a profile-defined Digit Style or ask to use the default style.");
    }

  });
}

function validateThemeProject(
  theme: ThemeProject,
  profile: DeviceProfile,
  assets: ReadonlyMap<string, Asset>,
  path: string,
  issues: ValidationIssue[],
): void {
  const rotationAngles = theme.rotations.map((rotation) => rotation.angle);
  const expectedAngles = [0, 90, 180, 270] as const;
  if (theme.rotations.length !== 4 || expectedAngles.some((angle) => !rotationAngles.includes(angle))) {
    issue(issues, "REQUIRED_ROTATIONS_MISSING", "A Theme Project must contain exactly Rotation/Form 0, 90, 180 and 270.", `${path}.rotations`, "Add every required rotation before publishing.");
  }

  const rotationIds = new Set<string>();
  theme.rotations.forEach((rotation, rotationIndex) => {
    if (rotationIds.has(rotation.id)) {
      issue(issues, "DUPLICATE_ROTATION_ID", `Rotation ID '${rotation.id}' is duplicated.`, `${path}.rotations[${rotationIndex}].id`, "Assign a unique stable Rotation ID.");
    }
    rotationIds.add(rotation.id);
    if (profile.supportedRotations && !profile.supportedRotations.includes(rotation.angle)) {
      issue(issues, "UNSUPPORTED_ROTATION", `Rotation ${rotation.angle} is not supported by the active DeviceProfile.`, `${path}.rotations[${rotationIndex}]`, "Use a supported rotation/form.");
    }
    const sceneIds = new Set<string>();
    rotation.scenes.forEach((scene, sceneIndex) => {
      if (sceneIds.has(scene.id)) {
        issue(issues, "DUPLICATE_SCENE_ID", `Scene ID '${scene.id}' is duplicated within the rotation.`, `${path}.rotations[${rotationIndex}].scenes[${sceneIndex}].id`, "Assign a unique stable Scene ID.");
      }
      sceneIds.add(scene.id);
      validateScene(scene, profile, assets, `${path}.rotations[${rotationIndex}].scenes[${sceneIndex}]`, issues, { width: rotation.width, height: rotation.height });
    });
    // A Rotation / Form with no Scene renders nothing for that physical
    // orientation; the theme is publishable but incomplete.
    if ((Array.isArray(rotation.scenes) ? rotation.scenes : []).length === 0) {
      issue(issues, "ROTATION_WITHOUT_SCENE", `Rotation / Form R${rotation.angle} of '${theme.name}' has no Scene and would render nothing in that orientation.`, `${path}.rotations[${rotationIndex}].scenes`, "Add at least one Scene to this Rotation / Form.", "warning");
    }
    const duplicateSceneNames = new Set<string>();
    const seenSceneNames = new Set<string>();
    (Array.isArray(rotation.scenes) ? rotation.scenes : []).forEach((scene) => {
      const key = scene.name.trim().toLowerCase();
      if (seenSceneNames.has(key)) duplicateSceneNames.add(scene.name.trim());
      seenSceneNames.add(key);
    });
    duplicateSceneNames.forEach((name) => issue(issues, "DUPLICATE_SCENE_NAME", `Rotation / Form R${rotation.angle} has more than one Scene named '${name}'.`, `${path}.rotations[${rotationIndex}].scenes`, "Rename one of them so the Scene switcher and runtime traces stay unambiguous.", "warning"));
  });

  theme.resources.forEach((assetId, index) => validateAssetReference(assetId, assets, `${path}.resources[${index}]`, issues));
  theme.defaultAssetIds?.forEach((assetId, index) => validateAssetReference(assetId, assets, `${path}.defaultAssetIds[${index}]`, issues));
  theme.floorMappings?.forEach((mapping, index) => validateFloorMapping(mapping, profile, new Set(assets.keys()), `${path}.floorMappings[${index}]`, issues));
}

/**
 * Every asset id the document actually points at. An unused resource that the
 * profile cannot classify is a legitimate resting state (a dropped file awaiting
 * a type, WIDGET_SYSTEM_QUESTIONNAIRE_V1:225-233), so it must not block a build;
 * the same asset REFERENCED by a theme or widget must, because the package would
 * then carry it.
 */
function collectReferencedAssetIds(project: Project, profile?: DeviceProfile): ReadonlySet<string> {
  const referenced = new Set<string>([...(project.defaultAssetIds ?? []), ...(profile?.defaultAssetIds ?? [])]);
  for (const group of project.themeProjectGroups) {
    for (const theme of group.themeProjects) {
      theme.resources.forEach((id) => referenced.add(id));
      theme.defaultAssetIds?.forEach((id) => referenced.add(id));
      for (const rotation of theme.rotations) {
        for (const scene of Array.isArray(rotation.scenes) ? rotation.scenes : []) {
          for (const widget of Array.isArray(scene.widgets) ? scene.widgets : []) {
            (Array.isArray(widget.assetIds) ? (widget.assetIds as readonly string[]) : []).forEach((id) => referenced.add(id));
            if (widget.audioAssetId) referenced.add(widget.audioAssetId);
            if (widget.mediaSlide) {
              referenced.add(widget.mediaSlide.assetId);
              if (widget.mediaSlide.audioAssetId) referenced.add(widget.mediaSlide.audioAssetId);
            }
            (Array.isArray(widget.bindings) ? (widget.bindings as readonly Binding[]) : []).forEach((binding) => { if (binding.contentId) referenced.add(binding.contentId); });
          }
        }
      }
    }
  }
  return referenced;
}

export function validateProject(project: Project, profile?: DeviceProfile): ValidationResult {
  const issues: ValidationIssue[] = [];
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  const assets = new Map(project.assets.map((asset) => [asset.id, asset]));
  const referencedAssetIds = collectReferencedAssetIds(project, profile);

  if (project.name.trim().length === 0) {
    issue(issues, "PROJECT_NAME_REQUIRED", "Project name is required.", "name", "Provide a non-empty project name.");
  }
  if (project.schemaVersion < 1) {
    issue(issues, "PROJECT_SCHEMA_UNSUPPORTED", "Project schema version is not supported.", "schemaVersion", "Migrate the project to schema version 1 or newer.");
  }
  if (project.deviceProfileId.trim().length === 0) {
    issue(issues, "DEVICE_PROFILE_REQUIRED", "A device profile must be selected.", "deviceProfileId", "Select a device profile before editing the project.");
  }

  const duplicateAssetIds = project.assets.filter((asset, index) => project.assets.findIndex((candidate) => candidate.id === asset.id) !== index);
  uniqueIds(duplicateAssetIds).forEach((id) => issue(issues, "DUPLICATE_STABLE_ID", `Asset stable ID '${id}' is duplicated in the project scope.`, "assets", "Rename or merge the duplicated asset reference."));
  project.assets.forEach((asset, index) => {
    if (asset.name.trim().length === 0) issue(issues, "ASSET_NAME_REQUIRED", "Asset display name is required.", `assets[${index}].name`, "Provide a display name without changing the stable ID.");
    if (asset.sourcePath.trim().length === 0) issue(issues, "ASSET_SOURCE_REQUIRED", "Asset source path is required.", `assets[${index}].sourcePath`, "Import or locate the source asset.");
    if (!asset.mediaType && !referencedAssetIds.has(asset.id)) {
      // An imported file exists before its semantic type is chosen. That is a
      // legitimate resting state, so it informs rather than blocks - unless the
      // asset is actually referenced, which is checked below.
      issue(issues, "ASSET_TYPE_UNASSIGNED", `Asset '${asset.name}' has no media type yet.`, `assets[${index}].mediaType`, "Choose Image, Video or Audio in Properties, or delete the asset if the active DeviceProfile cannot use its format.", "warning");
    }
  });

  // A project without any Theme Project is not publishable; validation must
  // never pass on an empty project shell.
  const themeCount = project.themeProjectGroups.reduce((count, group) => count + group.themeProjects.length, 0);
  if (themeCount === 0) {
    issue(issues, "THEME_PROJECT_REQUIRED", "A project must contain at least one Theme Project.", "themeProjectGroups", "Add a Theme Project before publishing.");
  }

  // Project-scope stable ID uniqueness for hierarchy nodes and widgets.
  const groupIds = new Set<string>();
  const themeIds = new Set<string>();
  const widgetIds = new Set<string>();
  project.themeProjectGroups.forEach((group, groupIndex) => {
    if (groupIds.has(group.id)) issue(issues, "DUPLICATE_GROUP_ID", `Theme Project Group ID '${group.id}' is duplicated in the project scope.`, `themeProjectGroups[${groupIndex}].id`, "Assign a unique stable Group ID.");
    groupIds.add(group.id);
    group.themeProjects.forEach((theme, themeIndex) => {
      if (themeIds.has(theme.id)) issue(issues, "DUPLICATE_THEME_ID", `Theme Project ID '${theme.id}' is duplicated in the project scope.`, `themeProjectGroups[${groupIndex}].themeProjects[${themeIndex}].id`, "Assign a unique stable Theme ID.");
      themeIds.add(theme.id);
      theme.rotations.forEach((rotation) => (Array.isArray(rotation.scenes) ? rotation.scenes : []).forEach((scene) => (Array.isArray(scene.widgets) ? (scene.widgets as readonly Widget[]) : []).forEach((widget) => {
        if (widgetIds.has(widget.id)) issue(issues, "DUPLICATE_WIDGET_ID", `Widget ID '${widget.id}' is duplicated in the project scope.`, "widgets", "Assign a unique stable Widget ID.");
        widgetIds.add(widget.id);
      })));
    });
  });

  if (!profile) {
    return { valid: issues.every((current) => current.severity !== "error"), issues };
  }

  // A removed or retyped runtime state is caught per-reference elsewhere, but
  // only the recorded version reveals that the registry moved at all, which is
  // what RUNTIME_STATE_REGISTRY:371,381 asks the Designer to detect.
  if (project.deviceProfileVersion === undefined) {
    issue(
      issues,
      "DEVICE_PROFILE_VERSION_UNRECORDED",
      "This template does not record which DeviceProfile version it was authored against.",
      "deviceProfileVersion",
      `Use Project ▸ Adopt Active Profile Version to record ${profile.version}; firmware drift cannot be detected without it.`,
      "warning",
    );
  } else if (project.deviceProfileVersion !== profile.version) {
    issue(
      issues,
      "DEVICE_PROFILE_VERSION_DRIFT",
      `This template was authored against DeviceProfile '${profile.id}' version ${project.deviceProfileVersion}, but version ${profile.version} is active.`,
      "deviceProfileVersion",
      "Review every binding and Scene activation condition, then adopt the active version. A state that was removed or retyped is reported separately.",
      "warning",
    );
  }

  if (project.deviceProfileId !== profile.id) {
    issue(issues, "DEVICE_PROFILE_MISMATCH", `Project profile '${project.deviceProfileId}' does not match '${profile.id}'.`, "deviceProfileId", "Resolve the active DeviceProfile before validation.");
  }

  const supportedFormats = (profile.supportedFormats ?? []).map((format) => format.toLowerCase());
  if (supportedFormats.length > 0) {
    project.assets.forEach((asset, index) => {
      const extension = asset.sourcePath.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase();
      if (extension && !supportedFormats.includes(extension)) {
        // Unused: the resource simply stays Unsupported and informs. Referenced:
        // the package would carry it, so it blocks.
        const referenced = referencedAssetIds.has(asset.id);
        issue(
          issues,
          "ASSET_FORMAT_UNSUPPORTED",
          referenced
            ? `Asset '${asset.name}' is referenced but its format '.${extension}' is not supported by the active DeviceProfile.`
            : `Asset '${asset.name}' has format '.${extension}', which the active DeviceProfile does not support, so it stays unsupported.`,
          `assets[${index}].sourcePath`,
          referenced ? "Replace it with a profile-supported format, or remove the reference." : "Convert it to a supported format, or delete the resource. It cannot be assigned to a widget as it is.",
          referenced ? "error" : "warning",
        );
      }
    });
  }

  project.defaultAssetIds?.forEach((assetId, index) => validateAssetReference(assetId, assets, `defaultAssetIds[${index}]`, issues));
  profile.defaultAssetIds?.forEach((assetId, index) => validateAssetReference(assetId, assets, `deviceProfile.defaultAssetIds[${index}]`, issues));
  project.themeProjectGroups.forEach((group, groupIndex) =>
    group.themeProjects.forEach((theme, themeIndex) => validateThemeProject(theme, profile, assets, `themeProjectGroups[${groupIndex}].themeProjects[${themeIndex}]`, issues)),
  );

  return {
    valid: issues.every((current) => current.severity !== "error"),
    issues,
  };
}
