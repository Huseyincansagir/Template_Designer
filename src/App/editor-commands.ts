import type { SelectionKind } from "./editor-types";

export type EditorCommandId =
  | "project.add-theme-project"
  | "theme.add-rotation"
  | "rotation.add-scene"
  | "scene.reorder"
  | "scene.move"
  | "widget.reorder"
  | "widget.move"
  | "widget.edit-properties"
  | "canvas.delete-selection";

export type EditorCommandDescriptor = {
  id: EditorCommandId;
  label: string;
  shortcut?: string;
  supportedSelectionKinds: readonly SelectionKind[];
  disabledReason?: string;
};

/**
 * UI command palette/context-menu descriptors. Execution is intentionally
 * injected later through the canonical application command/use-case layer.
 */
export const editorCommandDescriptors: readonly EditorCommandDescriptor[] = [
  { id: "project.add-theme-project", label: "Add Theme Project", supportedSelectionKinds: ["project", "theme-group"] },
  { id: "theme.add-rotation", label: "Add Rotation", supportedSelectionKinds: ["theme"] },
  { id: "rotation.add-scene", label: "Add Scene", supportedSelectionKinds: ["rotation"] },
  { id: "scene.reorder", label: "Reorder Scene", supportedSelectionKinds: ["scene"], disabledReason: "Ordering command is not connected" },
  { id: "scene.move", label: "Move Scene", supportedSelectionKinds: ["scene"], disabledReason: "Move command is not connected" },
  { id: "widget.reorder", label: "Reorder Widget", supportedSelectionKinds: ["widget"], disabledReason: "Ordering command is not connected" },
  { id: "widget.move", label: "Move Widget", supportedSelectionKinds: ["widget"], disabledReason: "Geometry command is not connected" },
  { id: "widget.edit-properties", label: "Edit Properties", supportedSelectionKinds: ["widget", "scene", "rotation", "theme", "theme-group", "project", "asset"] },
  { id: "canvas.delete-selection", label: "Delete Selection", shortcut: "Delete", supportedSelectionKinds: ["widget"], disabledReason: "Delete command is not connected" },
];

export function commandsForSelection(selectionKind: SelectionKind | undefined): readonly EditorCommandDescriptor[] {
  if (!selectionKind) return editorCommandDescriptors;
  return editorCommandDescriptors.filter((command) => command.supportedSelectionKinds.includes(selectionKind));
}
