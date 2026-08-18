import { describe, expect, it } from "vitest";
import { buildShortcutRegistry, canonicalShortcuts, matchShortcut, shortcutDisplay, shortcutRegistry } from "../src/App/shortcut-registry";
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
    // Shift variants are not silently treated as their unshifted binding.
    expect(matchShortcut({ key: "z", ctrlKey: true, metaKey: false, shiftKey: true, platformHint: "Win32" }, shortcutRegistry)).toBeNull();
    expect(matchShortcut({ key: "Delete", ctrlKey: false, metaKey: false, shiftKey: false, platformHint: "Win32" }, shortcutRegistry)?.id).toBe("delete");
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

  it("makes integer conditions match string simulator values", () => {
    const condition = { stateId: "floor", operator: "equals" as const, value: 6 };
    expect(conditionMatches(condition, { values: { floor: "6" } }, foundationDeviceProfile)).toBe(true);
    expect(conditionMatches({ ...condition, operator: "greater-than" }, { values: { floor: "7" } }, foundationDeviceProfile)).toBe(true);
    expect(conditionMatches({ ...condition, operator: "not-equals" }, { values: { floor: "6" } }, foundationDeviceProfile)).toBe(false);
  });

  it("applies negation symmetrically, including on unset inputs", () => {
    const condition = { stateId: "floor", operator: "equals" as const, value: 6, negated: true };
    expect(conditionMatches(condition, { values: { floor: 6 } }, foundationDeviceProfile)).toBe(false);
    expect(conditionMatches(condition, { values: { floor: 5 } }, foundationDeviceProfile)).toBe(true);
    // NOT(floor==6) holds while floor is unset.
    expect(conditionMatches(condition, { values: {} }, foundationDeviceProfile)).toBe(true);
    expect(conditionMatches({ ...condition, negated: false }, { values: {} }, foundationDeviceProfile)).toBe(false);
  });
});
