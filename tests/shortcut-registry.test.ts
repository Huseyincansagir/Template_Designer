import { describe, expect, it } from "vitest";
import { buildShortcutRegistry, canonicalShortcuts, matchShortcut, shortcutDisplay, shortcutRegistry } from "../src/App/shortcut-registry";
import { calculateNudgeStep } from "../src/App/canvas-interaction";
import { coerceToDefinitionType, conditionMatches } from "../src/Core/runtime";
import { foundationDeviceProfile } from "../src/Domain/factories";

describe("Shortcut registry (H-05 remediation)", () => {
  it("matches the canonical Mod-normalized table and rejects wrong-platform modifiers", () => {
    // Windows/Linux: Ctrl.
    expect(matchShortcut({ key: "z", ctrlKey: true, metaKey: false, shiftKey: false, platformHint: "Win32" }, shortcutRegistry)?.id).toBe("undo");
    expect(matchShortcut({ key: "z", ctrlKey: false, metaKey: true, shiftKey: false, platformHint: "Win32" }, shortcutRegistry)).toBeNull();
    expect(matchShortcut({ key: "s", ctrlKey: true, metaKey: true, shiftKey: false, platformHint: "Win32" }, shortcutRegistry)).toBeNull();
    // macOS: Meta.
    expect(matchShortcut({ key: "z", ctrlKey: false, metaKey: true, shiftKey: false, platformHint: "MacIntel" }, shortcutRegistry)?.id).toBe("undo");
    expect(matchShortcut({ key: "z", ctrlKey: true, metaKey: false, shiftKey: false, platformHint: "MacIntel" }, shortcutRegistry)).toBeNull();
    // Shift variants resolve to their own binding, never to the unshifted one.
    expect(matchShortcut({ key: "z", ctrlKey: true, metaKey: false, shiftKey: true, platformHint: "Win32" }, shortcutRegistry)?.id).toBe("redo-alt");
    expect(matchShortcut({ key: "y", ctrlKey: true, metaKey: false, shiftKey: true, platformHint: "Win32" }, shortcutRegistry)).toBeNull();
    expect(matchShortcut({ key: "Delete", ctrlKey: false, metaKey: false, shiftKey: false, platformHint: "Win32" }, shortcutRegistry)?.id).toBe("delete");
  });

  it("keeps the Alt navigation family separate from geometry nudges", () => {
    // Alt+Arrow is the Scene/Rotation navigation family. `calculateNudgeStep`
    // refuses Alt, so a navigation shortcut can never move a widget.
    expect(matchShortcut({ key: "ArrowRight", ctrlKey: false, metaKey: false, shiftKey: false, altKey: true, platformHint: "Win32" }, shortcutRegistry)?.id).toBe("scene-next");
    expect(matchShortcut({ key: "ArrowLeft", ctrlKey: false, metaKey: false, shiftKey: false, altKey: true, platformHint: "Win32" }, shortcutRegistry)?.id).toBe("scene-previous");
    expect(matchShortcut({ key: "ArrowDown", ctrlKey: false, metaKey: false, shiftKey: false, altKey: true, platformHint: "Win32" }, shortcutRegistry)?.id).toBe("rotation-next");
    expect(matchShortcut({ key: "ArrowUp", ctrlKey: false, metaKey: false, shiftKey: false, altKey: true, platformHint: "Win32" }, shortcutRegistry)?.id).toBe("rotation-previous");
    // Without Alt the same arrows are NOT navigation.
    expect(matchShortcut({ key: "ArrowRight", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, platformHint: "Win32" }, shortcutRegistry)).toBeNull();
    expect(calculateNudgeStep(10, { shift: false, modifier: false, alt: true })).toBeNull();
    expect(matchShortcut({ key: "F2", ctrlKey: false, metaKey: false, shiftKey: false, platformHint: "Win32" }, shortcutRegistry)?.id).toBe("rename");
    expect(matchShortcut({ key: "0", ctrlKey: true, metaKey: false, shiftKey: false, platformHint: "Win32" }, shortcutRegistry)?.id).toBe("zoom-reset");
  });

  it("detects conflicts at registry build time", () => {
    const conflict = [
      { id: "first", label: "First", binding: { mod: true, key: "z" } },
      { id: "second", label: "Second", binding: { mod: true, key: "z" } },
    ];
    expect(() => buildShortcutRegistry(conflict)).toThrow(/conflict/i);
  });

  it("displays platform-correct labels", () => {
    expect(shortcutDisplay(canonicalShortcuts.find((descriptor) => descriptor.id === "undo")!)).toMatch(/^Ctrl\+Z$|^Cmd\+Z$/);
    expect(canonicalShortcuts.some((descriptor) => descriptor.id === "rotate" || descriptor.label === "90° rotation")).toBe(false);
  });
});

describe("Runtime coercion (INT-55 remediation)", () => {
  it("coerces string inputs to their declared numeric types at the evaluator boundary", () => {
    expect(coerceToDefinitionType("6", "integer")).toBe(6);
    expect(coerceToDefinitionType(" 6 ", "integer")).toBe(6);
    expect(coerceToDefinitionType("6.5", "number")).toBe(6.5);
    expect(coerceToDefinitionType("not-a-number", "integer")).toBe("not-a-number");
    expect(coerceToDefinitionType("en", "enum")).toBe("en");
    expect(coerceToDefinitionType(null, "integer")).toBeNull();
  });

  it("treats a symbolic floor identifier as Unicode text, not a number", () => {
    // Product decision: floor identifiers are SYMBOLIC STRINGS. `floor` is a
    // string state, so a numeric literal and its string spelling agree, and
    // letters and words are first-class identifiers rather than invalid input.
    const condition = { stateId: "floor", operator: "equals" as const, value: "6" };
    expect(conditionMatches(condition, { values: { floor: "6" } }, foundationDeviceProfile)).toBe(true);
    expect(conditionMatches({ ...condition, value: 6 }, { values: { floor: "6" } }, foundationDeviceProfile)).toBe(true);
    expect(conditionMatches({ ...condition, value: "G" }, { values: { floor: "G" } }, foundationDeviceProfile)).toBe(true);
    expect(conditionMatches({ ...condition, value: "Restaurant" }, { values: { floor: "Restaurant" } }, foundationDeviceProfile)).toBe(true);
    expect(conditionMatches({ ...condition, value: "B2" }, { values: { floor: "B1" } }, foundationDeviceProfile)).toBe(false);
    expect(conditionMatches({ ...condition, operator: "not-equals", value: "6" }, { values: { floor: "6" } }, foundationDeviceProfile)).toBe(false);
    // `contains` is meaningful for symbolic identifiers.
    expect(conditionMatches({ ...condition, operator: "contains", value: "erra" }, { values: { floor: "Terrace" } }, foundationDeviceProfile)).toBe(true);
    // Unicode-safe: a composed and a decomposed spelling are ONE identifier.
    expect(conditionMatches({ ...condition, value: "\u00c7at\u0131" }, { values: { floor: "C\u0327at\u0131" } }, foundationDeviceProfile)).toBe(true);
    // A localized identifier works without any Arabic-specific handling.
    expect(conditionMatches({ ...condition, value: "\u0627\u0644\u0637\u0627\u0628\u0642" }, { values: { floor: "\u0627\u0644\u0637\u0627\u0628\u0642" } }, foundationDeviceProfile)).toBe(true);
  });

  it("applies negation symmetrically, including on unset inputs", () => {
    const condition = { stateId: "floor", operator: "equals" as const, value: "6", negated: true };
    expect(conditionMatches(condition, { values: { floor: "6" } }, foundationDeviceProfile)).toBe(false);
    expect(conditionMatches(condition, { values: { floor: "5" } }, foundationDeviceProfile)).toBe(true);
    // NOT(floor==6) holds while floor is unset.
    expect(conditionMatches(condition, { values: {} }, foundationDeviceProfile)).toBe(true);
    expect(conditionMatches({ ...condition, negated: false }, { values: {} }, foundationDeviceProfile)).toBe(false);
  });

  it("matches a setting-sourced condition against context.settings, not values (D5-10)", () => {
    const language = { stateId: "language", operator: "equals" as const, value: "en", source: "setting" as const };
    expect(conditionMatches(language, { values: { language: "tr" }, settings: { language: "en" } }, foundationDeviceProfile)).toBe(true);
    expect(conditionMatches(language, { values: { language: "en" }, settings: { language: "tr" } }, foundationDeviceProfile)).toBe(false);
    expect(conditionMatches(
      { stateId: "language", operator: "equals", value: "en" },
      { values: {}, settings: { language: "en" } },
      foundationDeviceProfile,
    )).toBe(false);
  });
});
