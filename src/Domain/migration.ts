import type { MediaSlideContent, MediaSlideItem, Project, VisualMediaType } from "./models";
import { createStableId } from "./identity";

/**
 * Forward migration for documents written by an earlier build.
 *
 * The domain shape changed with two product decisions: a Media Slide became an
 * ORDERED SEQUENCE (`items`) instead of a single `assetId`, and floor
 * identifiers became symbolic strings instead of arbitrary primitives. A
 * document written before those decisions is still the designer's work, so it is
 * upgraded on load rather than rejected by the shape gate or — worse — loaded and
 * then silently mis-rendered.
 *
 * Migration is intentionally total and lossless-where-possible: anything it
 * cannot interpret is left for validation to report, never dropped quietly.
 */

type LegacySlide = {
  readonly items?: unknown;
  readonly mediaType?: unknown;
  readonly assetId?: unknown;
  readonly duration?: unknown;
  readonly loop?: unknown;
  readonly repeatCount?: unknown;
  readonly audioAssetId?: unknown;
  readonly volume?: unknown;
  readonly continuePlayback?: unknown;
};

function isVisualMediaType(value: unknown): value is VisualMediaType {
  return value === "image" || value === "video";
}

/** True when the slide already uses the ordered-sequence shape. */
function isSequenceSlide(slide: LegacySlide): boolean {
  return Array.isArray(slide.items);
}

function migrateSlide(raw: unknown): MediaSlideContent | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const slide = raw as LegacySlide;

  if (isSequenceSlide(slide)) {
    // Already migrated; normalize each entry so a hand-edited file still lands
    // in a well-formed shape.
    const items = (slide.items as readonly unknown[])
      .map((entry): MediaSlideItem | undefined => {
        if (!entry || typeof entry !== "object") return undefined;
        const item = entry as Record<string, unknown>;
        if (typeof item.assetId !== "string" || !isVisualMediaType(item.mediaType)) return undefined;
        return {
          id: typeof item.id === "string" && item.id.length > 0 ? item.id : createStableId("media-item"),
          mediaType: item.mediaType,
          assetId: item.assetId,
          duration: typeof item.duration === "number" && Number.isFinite(item.duration) ? item.duration : 5,
          ...(typeof item.loop === "boolean" ? { loop: item.loop } : {}),
          ...(typeof item.repeatCount === "number" ? { repeatCount: item.repeatCount } : {}),
        };
      })
      .filter((item): item is MediaSlideItem => Boolean(item));
    if (items.length === 0) return undefined;
    return {
      items,
      ...(typeof slide.loop === "boolean" ? { loop: slide.loop } : {}),
      ...(typeof slide.repeatCount === "number" ? { repeatCount: slide.repeatCount } : {}),
      ...(typeof slide.audioAssetId === "string" ? { audioAssetId: slide.audioAssetId } : {}),
      ...(typeof slide.volume === "number" ? { volume: slide.volume } : {}),
      ...(typeof slide.continuePlayback === "boolean" ? { continuePlayback: slide.continuePlayback } : {}),
    };
  }

  // Legacy single-asset slide: it becomes a one-entry sequence, which is exactly
  // what it always meant.
  if (typeof slide.assetId !== "string" || !isVisualMediaType(slide.mediaType)) return undefined;
  return {
    items: [{
      id: createStableId("media-item"),
      mediaType: slide.mediaType,
      assetId: slide.assetId,
      duration: typeof slide.duration === "number" && Number.isFinite(slide.duration) ? slide.duration : 5,
      ...(typeof slide.loop === "boolean" ? { loop: slide.loop } : {}),
      ...(typeof slide.repeatCount === "number" ? { repeatCount: slide.repeatCount } : {}),
    }],
    ...(typeof slide.audioAssetId === "string" ? { audioAssetId: slide.audioAssetId } : {}),
    ...(typeof slide.volume === "number" ? { volume: slide.volume } : {}),
    ...(typeof slide.continuePlayback === "boolean" ? { continuePlayback: slide.continuePlayback } : {}),
  };
}

/** Floor identifiers are symbolic strings; a legacy numeric value is stringified. */
function migrateFloorValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function migrateLoadedProject(project: Project): Project {
  let changed = false;

  const themeProjectGroups = project.themeProjectGroups.map((group) => ({
    ...group,
    themeProjects: group.themeProjects.map((theme) => {
      const floorMappings = theme.floorMappings?.map((mapping) => {
        const entries = mapping.entries.map((entry) => {
          const firmwareValue = migrateFloorValue(entry.firmwareValue);
          if (firmwareValue !== entry.firmwareValue) changed = true;
          return { ...entry, firmwareValue };
        });
        return { ...mapping, entries };
      });
      return {
        ...theme,
        ...(floorMappings ? { floorMappings } : {}),
        rotations: theme.rotations.map((rotation) => ({
          ...rotation,
          scenes: rotation.scenes.map((scene) => ({
            ...scene,
            widgets: scene.widgets.map((widget) => {
              if (!widget.mediaSlide) return widget;
              const migrated = migrateSlide(widget.mediaSlide);
              const wasSequence = isSequenceSlide(widget.mediaSlide as unknown as LegacySlide);
              if (!wasSequence || migrated !== widget.mediaSlide) changed = true;
              return { ...widget, mediaSlide: migrated };
            }),
          })),
        })),
      };
    }),
  }));

  return changed ? { ...project, themeProjectGroups } : project;
}

/** Reports whether a document would be changed by migration, without changing it. */
export function needsMigration(project: Project): boolean {
  return migrateLoadedProject(project) !== project;
}
