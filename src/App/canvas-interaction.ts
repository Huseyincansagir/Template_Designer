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

export type CanvasViewFrame = CanvasRect & { scale: number };

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

export type ZOrderOperation = "bring-forward" | "send-backward" | "bring-to-front" | "send-to-back";

export function calculateZOrderUpdates(widgets: readonly Widget[], widgetId: string, operation: ZOrderOperation): Readonly<Record<string, number>> | null {
  const targetIndex = widgets.findIndex((widget) => widget.id === widgetId);
  if (targetIndex < 0) return null;
  const target = widgets[targetIndex];
  // Z-order operations respect the lock: a locked widget cannot be re-stacked.
  if (target.locked) return null;
  if (widgets.length <= 1) return null;

  // Deterministic renumbering: the stacking total order (zIndex asc, array
  // index asc, stable ID asc) is normalized to sequential zIndex values, the
  // requested swap is applied to the order, and the changed zIndex values are
  // returned. This eliminates equal-z tie leapfrogging (§4.5).
  const ordered = widgets.map((widget, index) => ({ widget, index })).sort((left, right) => left.widget.zIndex - right.widget.zIndex || left.index - right.index || left.widget.id.localeCompare(right.widget.id));
  const position = ordered.findIndex((entry) => entry.widget.id === widgetId);
  const neighborPosition = operation === "bring-forward" || operation === "bring-to-front"
    ? position + 1
    : position - 1;
  const isFrontBack = operation === "bring-to-front" || operation === "send-to-back";
  const next: { widget: Widget; index: number }[] = [...ordered];
  if (isFrontBack) {
    if (operation === "bring-to-front") {
      if (position >= ordered.length - 1) return null;
      const [entry] = next.splice(position, 1);
      next.push(entry);
    } else {
      if (position <= 0) return null;
      const [entry] = next.splice(position, 1);
      next.unshift(entry);
    }
  } else {
    if (neighborPosition < 0 || neighborPosition >= ordered.length) return null;
    [next[position], next[neighborPosition]] = [next[neighborPosition], next[position]];
  }

  const updates: Record<string, number> = {};
  next.forEach((entry, index) => {
    // Locked widgets keep their zIndex; they still participate in the
    // stacking order above.
    if (entry.widget.locked) return;
    if (entry.widget.zIndex !== index) updates[entry.widget.id] = index;
  });
  return Object.keys(updates).length > 0 ? updates : null;
}

export const DEFAULT_GRID_SIZE = 10;
export const DEFAULT_SNAP_THRESHOLD = 6;
export const POINTER_DRAG_THRESHOLD = 4;
export const MIN_WIDGET_SIZE = 10;

export function exceedsPointerDragThreshold(distance: number): boolean {
  return Number.isFinite(distance) && distance > POINTER_DRAG_THRESHOLD;
}

export type KeyboardPlatform = "mac" | "windows" | "linux";

export function detectKeyboardPlatform(platformHint?: string): KeyboardPlatform {
  const value = platformHint ?? (typeof navigator === "undefined" ? "" : `${navigator.platform} ${navigator.userAgent}`);
  if (/mac|iphone|ipad|ipod/i.test(value)) return "mac";
  if (/win/i.test(value)) return "windows";
  return "linux";
}

export function isCanonicalModifier(event: { readonly metaKey: boolean; readonly ctrlKey: boolean }, platform = detectKeyboardPlatform()): boolean {
  return platform === "mac" ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

export function isCanvasKeyboardExcludedTarget(target: { readonly tagName?: string; readonly isContentEditable?: boolean }): boolean {
  return Boolean(target.isContentEditable) || ["INPUT", "TEXTAREA", "SELECT"].includes((target.tagName ?? "").toUpperCase());
}

export type NudgeModifiers = {
  readonly shift: boolean;
  readonly modifier: boolean;
  readonly alt?: boolean;
  /** Exact platform modifier flags; when supplied, ambiguous or wrong-platform modifiers produce no movement. */
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly platform?: KeyboardPlatform;
};

export function calculateNudgeStep(gridSize: number, modifiers: NudgeModifiers): number | null {
  if (!Number.isFinite(gridSize) || gridSize <= 0 || modifiers.alt) return null;
  let modifier = modifiers.modifier;
  const ctrl = modifiers.ctrlKey;
  const meta = modifiers.metaKey;
  if (ctrl !== undefined && meta !== undefined) {
    // Exact modifier set (§4.12): holding both modifiers is ambiguous, and a
    // wrong-platform Mod (Meta on Windows/Linux, Ctrl on macOS) must NOT
    // silently degrade to plain-Arrow movement.
    if (ctrl && meta) return null;
    const canonical = isCanonicalModifier({ metaKey: meta, ctrlKey: ctrl }, modifiers.platform);
    if ((ctrl || meta) && !canonical) return null;
    modifier = canonical;
  }
  if (modifiers.shift) return modifier ? gridSize * 5 : null;
  return modifier ? gridSize / 10 : gridSize;
}

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

export function getCanvasViewFrame(viewport: CanvasViewport, transform: CanvasViewTransform): CanvasViewFrame {
  const sceneWidth = safePositive(transform.sceneWidth);
  const sceneHeight = safePositive(transform.sceneHeight);
  const zoom = safePositive(transform.zoom);
  const scale = Math.min(viewport.width / sceneWidth, viewport.height / sceneHeight) * zoom;
  const width = sceneWidth * scale;
  const height = sceneHeight * scale;
  // §4.2: contentOrigin = viewport.top-left + ((viewport − content) / 2) + pan × fitScale
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
  const frame = getCanvasViewFrame(viewport, transform);
  return {
    x: (point.x - frame.x) / frame.scale,
    y: (point.y - frame.y) / frame.scale,
  };
}

/** Convert a Canvas point into CSS/screen coordinates using the same view transform. */
export function canvasToScreen(point: CanvasPoint, viewport: CanvasViewport, transform: CanvasViewTransform): CanvasPoint {
  const frame = getCanvasViewFrame(viewport, transform);
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

export type MarqueeSelectionMode = "intersect" | "contains";

export type MarqueeSelectionOptions = {
  readonly baseSelection?: readonly string[];
  readonly additive?: boolean;
  readonly mode?: MarqueeSelectionMode;
};

export function marqueeSelection(widgets: readonly Widget[], marquee: CanvasRect, options: MarqueeSelectionOptions = {}): string[] {
  const mode = options.mode ?? "intersect";
  // §4.8: V1 implements "intersect" only. Requesting "contains" must be
  // rejected explicitly — never silently treated as intersection.
  if (mode !== "intersect") throw new RangeError(`Unsupported marquee selection mode: ${String(mode)}`);
  // `enabled` is a runtime flag, not a design-time guard: a disabled widget is
  // still an object the designer must be able to select and fix (F13).
  const hits = widgets.filter((widget) => widget.visible && intersects(marquee, widget.geometry)).map((widget) => widget.id);
  return orderSelectionIds(widgets, options.additive ? [...(options.baseSelection ?? []), ...hits] : hits);
}

/** Highest z-order wins; equal z-order uses later Scene document order, then stable ID. */
export function hitTest(point: CanvasPoint, widgets: readonly Widget[]): string | null {
  return [...widgets]
    .map((widget, index) => ({ widget, index }))
    .filter(({ widget }) => widget.visible && containsPoint(widget.geometry, point))
    .sort((left, right) => right.widget.zIndex - left.widget.zIndex || right.index - left.index || right.widget.id.localeCompare(left.widget.id))
    .at(0)?.widget.id ?? null;
}

type SnapEdge = "start" | "end";

type AxisCandidate = { value: number; guide: SnapGuide; distance: number; edge: SnapEdge };

function candidateForAxis(
  axis: "x" | "y",
  candidate: Geometry,
  others: readonly Widget[],
  configuration: SnapConfiguration,
  edge: SnapEdge = "start",
): AxisCandidate | null {
  const sourceStart = axis === "x" ? candidate.x : candidate.y;
  const sourceSize = axis === "x" ? candidate.width : candidate.height;
  const sourceEdge = edge === "end" ? sourceStart + sourceSize : sourceStart;
  const threshold = Math.max(0, configuration.threshold);
  const gridCandidates: AxisCandidate[] = [];
  const edgeCandidates: AxisCandidate[] = [];
  const centerCandidates: AxisCandidate[] = [];

  if (configuration.grid !== false && configuration.gridSize > 0) {
    const gridValue = snapValue(sourceEdge, true, configuration.gridSize);
    const distance = Math.abs(gridValue - sourceEdge);
    if (distance <= threshold) gridCandidates.push({ value: gridValue, distance, guide: { axis, position: gridValue, kind: "grid" }, edge });
  }

  if (configuration.edges !== false || configuration.centers !== false) {
    for (const other of others) {
      const start = axis === "x" ? other.geometry.x : other.geometry.y;
      const size = axis === "x" ? other.geometry.width : other.geometry.height;
      const end = start + size;
      if (configuration.edges !== false) {
        for (const target of [start, end]) {
          // Start-edge snapping aligns the leading (target) or trailing
          // (target − sourceSize) edge; end-edge snapping mirrors it
          // (target, target + sourceSize) so east/south resize handles snap.
          for (const value of edge === "end" ? [target, target + sourceSize] : [target, target - sourceSize]) {
            const distance = Math.abs(value - sourceEdge);
            if (distance <= threshold) edgeCandidates.push({ value, distance, guide: { axis, position: target, kind: "edge", widgetId: other.id }, edge });
          }
        }
      }
      if (configuration.centers !== false) {
        const targetCenter = start + size / 2;
        const value = edge === "end" ? targetCenter + sourceSize / 2 : targetCenter - sourceSize / 2;
        const distance = Math.abs(value - sourceEdge);
        if (distance <= threshold) centerCandidates.push({ value, distance, guide: { axis, position: targetCenter, kind: "center", widgetId: other.id }, edge });
      }
    }
  }

  for (const pass of [gridCandidates, edgeCandidates, centerCandidates]) {
    if (pass.length) return pass.sort((left, right) => compareCandidates(left, right))[0];
  }
  return null;
}

export type SnapEndEdges = { readonly x?: boolean; readonly y?: boolean };

export function snapGeometryWithTargets(candidate: Geometry, configuration: SnapConfiguration, others: readonly Widget[] = [], endEdges: SnapEndEdges = {}): SnapResult {
  if (!configuration.enabled) return { geometry: candidate, guides: [] };
  const x = candidateForAxis("x", candidate, others, configuration, endEdges.x ? "end" : "start");
  const y = candidateForAxis("y", candidate, others, configuration, endEdges.y ? "end" : "start");
  const geometry = { ...candidate };
  if (x) {
    if (x.edge === "end") geometry.width = Math.max(MIN_WIDGET_SIZE, x.value - candidate.x);
    else geometry.x = x.value;
  }
  if (y) {
    if (y.edge === "end") geometry.height = Math.max(MIN_WIDGET_SIZE, y.value - candidate.y);
    else geometry.y = y.value;
  }
  return {
    geometry,
    guides: [x?.guide, y?.guide].filter((guide): guide is SnapGuide => Boolean(guide)),
  };
}

export function calculateSnapGuides(candidate: Geometry, configuration: SnapConfiguration, others: readonly Widget[] = []): readonly SnapGuide[] {
  return snapGeometryWithTargets(candidate, configuration, others).guides;
}

export type AlignOperation = "left" | "horizontal-center" | "right" | "top" | "vertical-middle" | "bottom";
export type DistributeOperation = "horizontal" | "vertical";

/**
 * Multi-selection alignment. Every widget moves to the selection's own bounding
 * box, which is the behaviour a layout tool is expected to have and the last
 * geometry operation the canvas was missing (D4-21). Sizes never change, so an
 * alignment can never violate the scene-bounds contract that the commit path
 * already enforces.
 *
 * Locked widgets are excluded by the caller, exactly like drag and resize.
 * Returns only the widgets whose geometry actually moves, so a no-op alignment
 * records no history.
 */
export function calculateAlignUpdates(
  widgets: readonly { readonly id: string; readonly geometry: Geometry }[],
  operation: AlignOperation,
): Record<string, Geometry> | null {
  if (widgets.length < 2) return null;
  const bounds = getBounds(widgets.map((widget) => widget.geometry));
  if (!bounds) return null;
  const updates: Record<string, Geometry> = {};
  for (const widget of widgets) {
    const { geometry } = widget;
    const next: Geometry = { ...geometry };
    if (operation === "left") next.x = bounds.x;
    else if (operation === "right") next.x = bounds.x + bounds.width - geometry.width;
    else if (operation === "horizontal-center") next.x = bounds.x + (bounds.width - geometry.width) / 2;
    else if (operation === "top") next.y = bounds.y;
    else if (operation === "bottom") next.y = bounds.y + bounds.height - geometry.height;
    else next.y = bounds.y + (bounds.height - geometry.height) / 2;
    next.x = Math.round(next.x);
    next.y = Math.round(next.y);
    if (next.x !== geometry.x || next.y !== geometry.y) updates[widget.id] = next;
  }
  return Object.keys(updates).length ? updates : null;
}

/**
 * Even spacing between the outermost widgets. The first and last keep their
 * position — they define the span — and the ones between them are placed at
 * equal gaps measured edge to edge, which is what makes a row of floor
 * indicators look deliberate rather than approximately spaced.
 */
export function calculateDistributeUpdates(
  widgets: readonly { readonly id: string; readonly geometry: Geometry }[],
  operation: DistributeOperation,
): Record<string, Geometry> | null {
  if (widgets.length < 3) return null;
  const horizontal = operation === "horizontal";
  const ordered = [...widgets].sort((left, right) => horizontal
    ? left.geometry.x - right.geometry.x
    : left.geometry.y - right.geometry.y);
  const first = ordered[0].geometry;
  const last = ordered[ordered.length - 1].geometry;
  const span = horizontal
    ? (last.x + last.width) - first.x
    : (last.y + last.height) - first.y;
  const occupied = ordered.reduce((total, widget) => total + (horizontal ? widget.geometry.width : widget.geometry.height), 0);
  // A negative gap means the widgets already overlap more than the span allows;
  // spreading them further would move the outermost ones, so refuse instead.
  const gap = (span - occupied) / (ordered.length - 1);
  if (!Number.isFinite(gap) || gap < 0) return null;
  const updates: Record<string, Geometry> = {};
  let cursor = horizontal ? first.x : first.y;
  for (const widget of ordered) {
    const { geometry } = widget;
    const position = Math.round(cursor);
    if (horizontal && position !== geometry.x) updates[widget.id] = { ...geometry, x: position };
    if (!horizontal && position !== geometry.y) updates[widget.id] = { ...geometry, y: position };
    cursor += (horizontal ? geometry.width : geometry.height) + gap;
  }
  return Object.keys(updates).length ? updates : null;
}
