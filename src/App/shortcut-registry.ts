import { detectKeyboardPlatform, isCanonicalModifier } from "./canvas-interaction";

/**
 * Single shortcut registry for the canonical keyboard table (UI §19, AGENT2
 * §4.12). Menu hints and Settings→Shortcuts read from this registry so an
 * advertised shortcut can never drift from its handler. Conflict detection
 * runs at module load.
 */

export type ShortcutBinding = {
  /** Platform-normalized primary modifier (Ctrl on Windows/Linux, Cmd on macOS). */
  readonly mod?: boolean;
  readonly shift?: boolean;
  /** Alt is the navigation modifier: `calculateNudgeStep` refuses Alt, so Alt+Arrow can never move a widget. */
  readonly alt?: boolean;
  readonly key: string;
};

export type ShortcutDescriptor = {
  readonly id: string;
  readonly label: string;
  readonly binding: ShortcutBinding;
};

export type ShortcutModifiers = {
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey?: boolean;
  readonly key: string;
};

function bindingKey(binding: ShortcutBinding, platform: string): string {
  return `${platform}:${binding.mod ? "mod+" : ""}${binding.alt ? "alt+" : ""}${binding.shift ? "shift+" : ""}${binding.key.toLowerCase()}`;
}

export function buildShortcutRegistry(descriptors: readonly ShortcutDescriptor[], platforms: readonly string[] = ["windows", "mac", "linux"]): ReadonlyMap<string, ShortcutDescriptor> {
  const registry = new Map<string, ShortcutDescriptor>();
  for (const platform of platforms) {
    for (const descriptor of descriptors) {
      const key = bindingKey(descriptor.binding, platform);
      const existing = registry.get(key);
      if (existing && existing.id !== descriptor.id) {
        throw new Error(`Shortcut conflict: '${existing.label}' and '${descriptor.label}' both bind ${key}`);
      }
      registry.set(key, descriptor);
    }
  }
  return registry;
}

export function matchShortcut(event: ShortcutModifiers & { platformHint?: string }, registry: ReadonlyMap<string, ShortcutDescriptor>): ShortcutDescriptor | null {
  const platform = detectKeyboardPlatform(event.platformHint);
  const canonical = isCanonicalModifier(event, platform);
  // Exact modifier sets: a wrong-platform modifier must not match.
  if ((event.ctrlKey || event.metaKey) && !canonical && event.key.toLowerCase() !== "escape") return null;
  const binding: ShortcutBinding = {
    mod: canonical,
    shift: event.shiftKey,
    alt: event.altKey ?? false,
    key: event.key,
  };
  return registry.get(bindingKey(binding, platform)) ?? null;
}

export function shortcutDisplay(descriptor: ShortcutDescriptor): string {
  const { mod, shift, alt, key } = descriptor.binding;
  const parts: string[] = [];
  if (mod) parts.push(detectKeyboardPlatform() === "mac" ? "Cmd" : "Ctrl");
  if (alt) parts.push(detectKeyboardPlatform() === "mac" ? "Option" : "Alt");
  if (shift) parts.push("Shift");
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join("+");
}

/**
 * The canonical CONFIRMED table (UI §19). R (90° rotation) is excluded: free
 * rotation is a future transform contract. Alt+Arrow is the navigation family
 * (Scene / Rotation), chosen because `calculateNudgeStep` refuses Alt, so a
 * navigation shortcut can never be confused with a geometry nudge.
 */
export const canonicalShortcuts: readonly ShortcutDescriptor[] = [
  { id: "undo", label: "Undo", binding: { mod: true, key: "z" } },
  { id: "redo", label: "Redo", binding: { mod: true, key: "y" } },
  { id: "redo-alt", label: "Redo (alternate)", binding: { mod: true, shift: true, key: "z" } },
  { id: "save", label: "Save", binding: { mod: true, key: "s" } },
  { id: "new", label: "New Project", binding: { mod: true, key: "n" } },
  { id: "copy", label: "Copy", binding: { mod: true, key: "c" } },
  { id: "cut", label: "Cut", binding: { mod: true, key: "x" } },
  { id: "paste", label: "Paste", binding: { mod: true, key: "v" } },
  { id: "select-all", label: "Select All", binding: { mod: true, key: "a" } },
  { id: "delete", label: "Delete Selection", binding: { key: "Delete" } },
  { id: "delete-backspace", label: "Delete Selection", binding: { key: "Backspace" } },
  { id: "escape", label: "Cancel", binding: { key: "Escape" } },
  { id: "rename", label: "Rename Selection", binding: { key: "F2" } },
  { id: "scene-next", label: "Next Scene", binding: { alt: true, key: "ArrowRight" } },
  { id: "scene-previous", label: "Previous Scene", binding: { alt: true, key: "ArrowLeft" } },
  { id: "rotation-next", label: "Next Rotation / Form", binding: { alt: true, key: "ArrowDown" } },
  { id: "rotation-previous", label: "Previous Rotation / Form", binding: { alt: true, key: "ArrowUp" } },
  { id: "zoom-reset", label: "Zoom to 100%", binding: { mod: true, key: "0" } },
];

export const shortcutRegistry = buildShortcutRegistry(canonicalShortcuts);
