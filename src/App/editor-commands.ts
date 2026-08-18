import type { SelectionKind } from "./editor-types";

export type EditorCommandId =
  | "project.add-theme-project"
  | "theme.add-rotation"
  | "rotation.add-scene"
  | "widget.bring-forward"
  | "widget.send-backward"
  | "widget.bring-to-front"
  | "widget.send-to-back"
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
  { id: "canvas.delete-selection", kind: "mutation", label: "Delete Selection", shortcut: "Delete", supportedSelectionKinds: ["widget", "scene", "rotation", "theme", "theme-group"] },
  { id: "widget.open-properties", kind: "navigation", label: "Open Properties", supportedSelectionKinds: ["widget"] },
];

export function commandsForSelection(selectionKind: SelectionKind | undefined): readonly EditorCommandDescriptor[] {
  if (!selectionKind) return editorCommandDescriptors;
  return editorCommandDescriptors.filter((command) => command.supportedSelectionKinds.includes(selectionKind));
}
