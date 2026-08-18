export type SelectionKind = "project" | "theme-group" | "theme" | "rotation" | "scene" | "widget" | "asset" | "canvas";

export type PanelMode = "docked" | "floating" | "collapsed" | "closed";

export type PanelId = "explorer" | "assets" | "properties" | "simulator" | "console";

export type PanelLayoutState = Record<PanelId, PanelMode>;
