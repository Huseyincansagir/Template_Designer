import type { PanelId, PanelLayoutState, PanelMode } from "./editor-types";

export const defaultPanelLayout: PanelLayoutState = {
  explorer: "docked",
  assets: "collapsed",
  properties: "docked",
  simulator: "collapsed",
  console: "docked",
};

export function setPanelLayoutMode(layout: PanelLayoutState, panel: PanelId, mode: PanelMode): PanelLayoutState {
  return { ...layout, [panel]: mode };
}

/**
 * Docking with real tab stacks: docking a panel never destroys its sibling's
 * docked state; the visible tab is UI state. The collapse switch is retained
 * for the layout-manager contract (tests) while App drives the tab stack.
 */
export function activateDockedPanel(layout: PanelLayoutState, panel: PanelId): PanelLayoutState {
  return { ...layout, [panel]: "docked" };
}

export function floatingPanels(layout: PanelLayoutState): PanelId[] {
  return (Object.keys(layout) as PanelId[]).filter((panel) => layout[panel] === "floating");
}
