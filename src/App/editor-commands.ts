import type { SelectionKind } from "./editor-types";

export type EditorCommandId =
  | "project.add-theme-project"
  | "theme.add-rotation"
  | "rotation.add-scene"
  | `scene.add-widget:${string}`
  | "widget.bring-forward"
  | "widget.send-backward"
  | "widget.bring-to-front"
  | "widget.send-to-back"
  | "widget.lock-toggle"
  | "widget.hide-toggle"
  | "widget.duplicate-mode"
  | "widget.add-binding"
  | "scene.hide-all"
  | "scene.show-all"
  | "canvas.delete-selection"
  | "widget.open-properties";

export type EditorCommandKind = "mutation" | "navigation";

export type EditorCommandDescriptor = {
  id: EditorCommandId;
  kind: EditorCommandKind;
  label: string;
  shortcut?: string;
  supportedSelectionKinds: readonly SelectionKind[];
};

export type EditorCommandOptions = {
  /** DeviceProfile-driven widget types; used to generate Add Widget entries. */
  readonly widgetTypes?: readonly string[];
};

/**
 * UI command palette/context-menu descriptors. Persistent operations are
 * executed through the canonical application/use-case layer. Navigation
 * entries are explicitly not document mutations.
 */
export const editorCommandDescriptors: readonly EditorCommandDescriptor[] = [
  { id: "project.add-theme-project", kind: "mutation", label: "Add Theme Project", supportedSelectionKinds: ["project", "theme-group"] },
  { id: "theme.add-rotation", kind: "mutation", label: "Add Rotation", supportedSelectionKinds: ["theme"] },
  { id: "rotation.add-scene", kind: "mutation", label: "Add Scene", supportedSelectionKinds: ["rotation"] },
  { id: "widget.bring-forward", kind: "mutation", label: "Bring Forward", supportedSelectionKinds: ["widget"] },
  { id: "widget.send-backward", kind: "mutation", label: "Send Backward", supportedSelectionKinds: ["widget"] },
  { id: "widget.bring-to-front", kind: "mutation", label: "Bring To Front", supportedSelectionKinds: ["widget"] },
  { id: "widget.send-to-back", kind: "mutation", label: "Send To Back", supportedSelectionKinds: ["widget"] },
  { id: "widget.lock-toggle", kind: "mutation", label: "Lock / Unlock", supportedSelectionKinds: ["widget"] },
  { id: "widget.hide-toggle", kind: "mutation", label: "Hide / Show", supportedSelectionKinds: ["widget"] },
  { id: "widget.duplicate-mode", kind: "mutation", label: "Duplicate Mode (click to place)", supportedSelectionKinds: ["widget"] },
  { id: "widget.add-binding", kind: "navigation", label: "Binding Editor", supportedSelectionKinds: ["widget"] },
  { id: "scene.hide-all", kind: "mutation", label: "Hide All Widgets", supportedSelectionKinds: ["scene"] },
  { id: "scene.show-all", kind: "mutation", label: "Show All Widgets", supportedSelectionKinds: ["scene"] },
  { id: "canvas.delete-selection", kind: "mutation", label: "Delete Selection", shortcut: "Delete", supportedSelectionKinds: ["widget", "scene", "rotation", "theme", "theme-group"] },
  { id: "widget.open-properties", kind: "navigation", label: "Open Properties", supportedSelectionKinds: ["widget"] },
];

export function commandsForSelection(
  selectionKind: SelectionKind | undefined,
  options: EditorCommandOptions = {},
): readonly EditorCommandDescriptor[] {
  const base = selectionKind
    ? editorCommandDescriptors.filter((command) => command.supportedSelectionKinds.includes(selectionKind))
    : editorCommandDescriptors;
  if (selectionKind !== "scene" || !options.widgetTypes?.length) return base;
  const addWidgetDescriptors: EditorCommandDescriptor[] = options.widgetTypes.map((widgetType) => ({
    id: `scene.add-widget:${widgetType}`,
    kind: "mutation",
    label: `Add ${widgetType.charAt(0).toUpperCase()}${widgetType.slice(1)} Widget`,
    supportedSelectionKinds: ["scene"],
  }));
  return [...addWidgetDescriptors, ...base];
}
