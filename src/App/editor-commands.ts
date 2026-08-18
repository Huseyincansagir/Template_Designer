import type { SelectionKind } from "./editor-types";

export type EditorCommandId =
  | "project.add-theme-group"
  | "project.add-theme-project"
  | "theme.duplicate"
  | "theme.delete"
  | "rotation.add-scene"
  | "scene.duplicate"
  | "scene.move-earlier"
  | "scene.move-later"
  | "scene.delete"
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
  | "asset.import"
  | "asset.delete"
  | "node.rename"
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
 *
 * Every hierarchy node carries its own create/rename/duplicate/delete actions:
 * the context menu used to offer container nodes nothing but Delete, so the
 * only way to rename or duplicate anything was the Properties panel or the
 * Widget menu (L-22/L-23/D2-10).
 *
 * `rotation` deliberately supports neither delete nor duplicate: a Theme
 * Project contains exactly R0/R90/R180/R270 and there is no Add Rotation
 * command, so either operation would leave a theme the UI cannot repair.
 */
export const editorCommandDescriptors: readonly EditorCommandDescriptor[] = [
  { id: "node.rename", kind: "navigation", label: "Rename…", shortcut: "F2", supportedSelectionKinds: ["project", "theme-group", "theme", "scene", "widget", "asset"] },
  { id: "project.add-theme-group", kind: "mutation", label: "Add Theme Project Group", supportedSelectionKinds: ["project"] },
  { id: "project.add-theme-project", kind: "mutation", label: "Add Theme Project", supportedSelectionKinds: ["project", "theme-group"] },
  { id: "theme.duplicate", kind: "mutation", label: "Duplicate Theme Project", supportedSelectionKinds: ["theme"] },
  { id: "theme.delete", kind: "mutation", label: "Delete Theme Project", supportedSelectionKinds: ["theme"] },
  { id: "rotation.add-scene", kind: "mutation", label: "Add Scene", supportedSelectionKinds: ["rotation", "scene"] },
  { id: "scene.duplicate", kind: "mutation", label: "Duplicate Scene", supportedSelectionKinds: ["scene"] },
  { id: "scene.move-earlier", kind: "mutation", label: "Move Scene Earlier", supportedSelectionKinds: ["scene"] },
  { id: "scene.move-later", kind: "mutation", label: "Move Scene Later", supportedSelectionKinds: ["scene"] },
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
  { id: "asset.import", kind: "mutation", label: "Import Asset…", supportedSelectionKinds: ["project", "theme-group", "theme", "asset"] },
  { id: "asset.delete", kind: "mutation", label: "Delete Asset", supportedSelectionKinds: ["asset"] },
  { id: "scene.delete", kind: "mutation", label: "Delete Scene", supportedSelectionKinds: ["scene"] },
  { id: "canvas.delete-selection", kind: "mutation", label: "Delete Selection", shortcut: "Delete", supportedSelectionKinds: ["widget", "theme-group"] },
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
