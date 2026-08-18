import type { Geometry, Project } from "../Domain/models";

export type CanvasPoint = { x: number; y: number };
export type CanvasRect = Geometry;

export function snapValue(value: number, enabled: boolean, step = 10): number {
  return enabled ? Math.round(value / step) * step : value;
}

export function snapGeometry(geometry: Geometry, enabled: boolean, step = 10): Geometry {
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

export function intersects(a: CanvasRect, b: CanvasRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function updateWidgetGeometries(project: Project, updates: Readonly<Record<string, Geometry>>): Project {
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
