import type { Geometry, Widget } from "../Domain/models";

export type CanvasPoint = { x: number; y: number };
export type CanvasRect = Geometry;
export type ResizeHandle = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

export type CanvasViewport = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type SceneFrame = {
  origin: CanvasPoint;
  width: number;
  height: number;
};

export type CanvasViewTransform = {
  zoom: number;
  pan: CanvasPoint;
  sceneWidth: number;
  sceneHeight: number;
};

export type SnapConfiguration = {
  enabled: boolean;
  gridSize: number;
  threshold: number;
  grid?: boolean;
  edges?: boolean;
  centers?: boolean;
};

export type SnapGuide = {
  axis: "x" | "y";
  position: number;
  kind: "grid" | "edge" | "center";
  widgetId?: string;
};

export type SnapResult = {
  geometry: Geometry;
  guides: readonly SnapGuide[];
};

export const DEFAULT_GRID_SIZE = 10;
export const DEFAULT_SNAP_THRESHOLD = 6;
export const MIN_WIDGET_SIZE = 10;

const SNAP_KIND_PRIORITY: Record<SnapGuide["kind"], number> = {
  grid: 0,
  edge: 1,
  center: 2,
};

function safePositive(value: number, fallback = 1): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function compareCandidates(left: { distance: number; guide: SnapGuide }, right: { distance: number; guide: SnapGuide }): number {
  const distanceDelta = left.distance - right.distance;
  if (Math.abs(distanceDelta) > Number.EPSILON) return distanceDelta;
  const kindDelta = SNAP_KIND_PRIORITY[left.guide.kind] - SNAP_KIND_PRIORITY[right.guide.kind];
  if (kindDelta !== 0) return kindDelta;
  return (left.guide.widgetId ?? "").localeCompare(right.guide.widgetId ?? "");
}

function sceneViewportRect(viewport: CanvasViewport, transform: CanvasViewTransform): CanvasRect & { scale: number } {
  const sceneWidth = safePositive(transform.sceneWidth);
  const sceneHeight = safePositive(transform.sceneHeight);
  const zoom = safePositive(transform.zoom);
  const scale = Math.min(viewport.width / sceneWidth, viewport.height / sceneHeight) * zoom;
  const width = sceneWidth * scale;
  const height = sceneHeight * scale;
  return {
    x: viewport.left + (viewport.width - width) / 2 + transform.pan.x * scale,
    y: viewport.top + (viewport.height - height) / 2 + transform.pan.y * scale,
    width,
    height,
    scale,
  };
}

/** Convert a CSS/screen point into Canvas coordinates while preserving scene aspect ratio. */
export function screenToCanvas(point: CanvasPoint, viewport: CanvasViewport, transform: CanvasViewTransform): CanvasPoint {
  const frame = sceneViewportRect(viewport, transform);
  return {
    x: (point.x - frame.x) / frame.scale,
    y: (point.y - frame.y) / frame.scale,
  };
}

/** Convert a Canvas point into CSS/screen coordinates using the same view transform. */
export function canvasToScreen(point: CanvasPoint, viewport: CanvasViewport, transform: CanvasViewTransform): CanvasPoint {
  const frame = sceneViewportRect(viewport, transform);
  return {
    x: frame.x + point.x * frame.scale,
    y: frame.y + point.y * frame.scale,
  };
}

export function canvasToScene(point: CanvasPoint, frame: SceneFrame): CanvasPoint {
  return { x: point.x - frame.origin.x, y: point.y - frame.origin.y };
}

export function sceneToCanvas(point: CanvasPoint, frame: SceneFrame): CanvasPoint {
  return { x: point.x + frame.origin.x, y: point.y + frame.origin.y };
}

export function clampCanvasPoint(point: CanvasPoint, sceneWidth: number, sceneHeight: number): CanvasPoint {
  return {
    x: Math.max(0, Math.min(sceneWidth, point.x)),
    y: Math.max(0, Math.min(sceneHeight, point.y)),
  };
}

export function snapValue(value: number, enabled: boolean, step = DEFAULT_GRID_SIZE): number {
  if (!enabled || !Number.isFinite(step) || step <= 0) return value;
  return Math.round(value / step) * step;
}

/**
 * Preserve the original grid helper contract. The richer edge/center snapping
 * implementation is exposed as snapGeometryWithTargets below.
 */
export function snapGeometry(geometry: Geometry, enabled: boolean, step = DEFAULT_GRID_SIZE): Geometry {
  return {
    x: snapValue(geometry.x, enabled, step),
    y: snapValue(geometry.y, enabled, step),
    width: Math.max(step, snapValue(geometry.width, enabled, step)),
    height: Math.max(step, snapValue(geometry.height, enabled, step)),
  };
}

export function normalizeRect(start: CanvasPoint, current: CanvasPoint): CanvasRect {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

/** Inclusive rectangle intersection; edge-touch counts as an intersection. */
export function intersects(a: CanvasRect, b: CanvasRect): boolean {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

export function containsPoint(rect: CanvasRect, point: CanvasPoint): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

export function getBounds(geometries: readonly Geometry[]): CanvasRect | null {
  if (!geometries.length) return null;
  const left = Math.min(...geometries.map((geometry) => geometry.x));
  const top = Math.min(...geometries.map((geometry) => geometry.y));
  const right = Math.max(...geometries.map((geometry) => geometry.x + geometry.width));
  const bottom = Math.max(...geometries.map((geometry) => geometry.y + geometry.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function moveGeometry(geometry: Geometry, delta: CanvasPoint): Geometry {
  return { ...geometry, x: geometry.x + delta.x, y: geometry.y + delta.y };
}

export function resizeGeometry(geometry: Geometry, handle: ResizeHandle | string, delta: CanvasPoint, minWidth = MIN_WIDGET_SIZE, minHeight = MIN_WIDGET_SIZE): Geometry {
  const minimumWidth = Math.max(0, minWidth);
  const minimumHeight = Math.max(0, minHeight);
  let left = geometry.x;
  let top = geometry.y;
  let right = geometry.x + geometry.width;
  let bottom = geometry.y + geometry.height;

  if (handle.includes("w")) left = Math.min(geometry.x + delta.x, right - minimumWidth);
  if (handle.includes("e")) right = Math.max(geometry.x + geometry.width + delta.x, left + minimumWidth);
  if (handle.includes("n")) top = Math.min(geometry.y + delta.y, bottom - minimumHeight);
  if (handle.includes("s")) bottom = Math.max(geometry.y + geometry.height + delta.y, top + minimumHeight);

  return { x: left, y: top, width: Math.max(minimumWidth, right - left), height: Math.max(minimumHeight, bottom - top) };
}

export function transformGeometryWithinBounds(geometry: Geometry, initialBounds: CanvasRect, nextBounds: CanvasRect): Geometry {
  const widthRatio = initialBounds.width > 0 ? nextBounds.width / initialBounds.width : 1;
  const heightRatio = initialBounds.height > 0 ? nextBounds.height / initialBounds.height : 1;
  return {
    x: nextBounds.x + (geometry.x - initialBounds.x) * widthRatio,
    y: nextBounds.y + (geometry.y - initialBounds.y) * heightRatio,
    width: geometry.width * widthRatio,
    height: geometry.height * heightRatio,
  };
}

export function selectIds(current: readonly string[], id: string, additive: boolean): string[] {
  if (!additive) return [id];
  return current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id];
}

export function orderSelectionIds(widgets: readonly Widget[], ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  const ordered = widgets.filter((widget) => wanted.has(widget.id)).map((widget) => widget.id);
  const known = new Set(ordered);
  return [...ordered, ...ids.filter((id) => !known.has(id))];
}

export function marqueeSelection(widgets: readonly Widget[], marquee: CanvasRect, baseSelection: readonly string[] = [], additive = false): string[] {
  const hits = widgets.filter((widget) => widget.visible && widget.enabled && intersects(marquee, widget.geometry)).map((widget) => widget.id);
  return orderSelectionIds(widgets, additive ? [...baseSelection, ...hits] : hits);
}

/** Highest z-order wins; equal z-order uses later Scene document order, then stable ID. */
export function hitTest(point: CanvasPoint, widgets: readonly Widget[]): string | null {
  return [...widgets]
    .map((widget, index) => ({ widget, index }))
    .filter(({ widget }) => widget.visible && widget.enabled && containsPoint(widget.geometry, point))
    .sort((left, right) => right.widget.zIndex - left.widget.zIndex || right.index - left.index || right.widget.id.localeCompare(left.widget.id))
    .at(0)?.widget.id ?? null;
}

function candidateForAxis(
  axis: "x" | "y",
  candidate: Geometry,
  others: readonly Widget[],
  configuration: SnapConfiguration,
): { value: number; guide: SnapGuide; distance: number } | null {
  const sourceStart = axis === "x" ? candidate.x : candidate.y;
  const sourceSize = axis === "x" ? candidate.width : candidate.height;
  const candidates: { value: number; guide: SnapGuide; distance: number }[] = [];
  const threshold = Math.max(0, configuration.threshold);

  if (configuration.grid !== false && configuration.gridSize > 0) {
    const gridValue = snapValue(sourceStart, true, configuration.gridSize);
    candidates.push({ value: gridValue, distance: Math.abs(gridValue - sourceStart), guide: { axis, position: gridValue, kind: "grid" } });
  }

  if (configuration.edges !== false || configuration.centers !== false) {
    for (const other of others) {
      const start = axis === "x" ? other.geometry.x : other.geometry.y;
      const size = axis === "x" ? other.geometry.width : other.geometry.height;
      const end = start + size;
      const targetEdges = [start, end];
      if (configuration.edges !== false) {
        for (const target of targetEdges) {
          const options = [
            { value: target, guide: target },
            { value: target - sourceSize, guide: target },
          ];
          for (const option of options) {
            const distance = Math.abs(option.value - sourceStart);
            if (distance <= threshold) candidates.push({ value: option.value, distance, guide: { axis, position: option.guide, kind: "edge", widgetId: other.id } });
          }
        }
      }
      if (configuration.centers !== false) {
        const targetCenter = start + size / 2;
        const value = targetCenter - sourceSize / 2;
        const distance = Math.abs(value - sourceStart);
        if (distance <= threshold) candidates.push({ value, distance, guide: { axis, position: targetCenter, kind: "center", widgetId: other.id } });
      }
    }
  }

  return candidates.sort((left, right) => compareCandidates(left, right)).at(0) ?? null;
}

export function snapGeometryWithTargets(candidate: Geometry, configuration: SnapConfiguration, others: readonly Widget[] = []): SnapResult {
  if (!configuration.enabled) return { geometry: candidate, guides: [] };
  const x = candidateForAxis("x", candidate, others, configuration);
  const y = candidateForAxis("y", candidate, others, configuration);
  return {
    geometry: { ...candidate, x: x?.value ?? candidate.x, y: y?.value ?? candidate.y },
    guides: [x?.guide, y?.guide].filter((guide): guide is SnapGuide => Boolean(guide)),
  };
}

export function calculateSnapGuides(candidate: Geometry, configuration: SnapConfiguration, others: readonly Widget[] = []): readonly SnapGuide[] {
  return snapGeometryWithTargets(candidate, configuration, others).guides;
}

export function updateWidgetGeometries(project: import("../Domain/models").Project, updates: Readonly<Record<string, Geometry>>): import("../Domain/models").Project {
  return {
    ...project,
    themeProjectGroups: project.themeProjectGroups.map((group) => ({
      ...group,
      themeProjects: group.themeProjects.map((theme) => ({
        ...theme,
        rotations: theme.rotations.map((rotation) => ({
          ...rotation,
          scenes: rotation.scenes.map((scene) => ({
            ...scene,
            widgets: scene.widgets.map((widget) => updates[widget.id] ? { ...widget, geometry: updates[widget.id] } : widget),
          })),
        })),
      })),
    })),
  };
}
