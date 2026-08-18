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

export function activateDockedPanel(layout: PanelLayoutState, panel: PanelId): PanelLayoutState {
  const next: PanelLayoutState = { ...layout, [panel]: "docked" };
  if (panel === "explorer") next.assets = "collapsed";
  if (panel === "assets") next.explorer = "collapsed";
  if (panel === "properties") next.simulator = "collapsed";
  if (panel === "simulator") next.properties = "collapsed";
  return next;
}

export function floatingPanels(layout: PanelLayoutState): PanelId[] {
  return (Object.keys(layout) as PanelId[]).filter((panel) => layout[panel] === "floating");
}
