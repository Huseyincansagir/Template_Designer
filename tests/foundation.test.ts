import { describe, expect, it } from "vitest";
import { CommandHistory, type Command } from "../src/Core/commands";
import { createEmptyProject } from "../src/Domain/factories";
import { validateProject } from "../src/Core/validation";

class SetValueCommand implements Command {
  readonly label = "Set value";

  constructor(
    private readonly target: { value: number },
    private readonly next: number,
  ) {}

  private previous = 0;

  execute(): void {
    this.previous = this.target.value;
    this.target.value = this.next;
  }

  undo(): void {
    this.target.value = this.previous;
  }
}

describe("Phase 0 foundation", () => {
  it("creates a versioned project with a device profile and theme boundary", () => {
    const project = createEmptyProject("Demo");

    expect(project).toMatchObject({
      name: "Demo",
      schemaVersion: 1,
      deviceProfileId: "foundation-profile",
    });
    expect(project.themes).toHaveLength(1);
    expect(project.assets).toEqual([]);
  });

  it("returns structured validation results", () => {
    const valid = validateProject(createEmptyProject());
    const invalid = validateProject({ ...createEmptyProject(), name: " " });

    expect(valid.valid).toBe(true);
    expect(valid.issues).toEqual([]);
    expect(invalid.valid).toBe(false);
    expect(invalid.issues[0]).toMatchObject({
      severity: "error",
      code: "PROJECT_NAME_REQUIRED",
    });
  });

  it("supports execute, undo, redo and redo invalidation", () => {
    const target = { value: 1 };
    const history = new CommandHistory();
    const first = new SetValueCommand(target, 2);
    const second = new SetValueCommand(target, 3);

    history.execute(first);
    history.execute(second);
    expect(target.value).toBe(3);
    expect(history.undo()).toBe(true);
    expect(target.value).toBe(2);
    expect(history.redo()).toBe(true);
    expect(target.value).toBe(3);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(false);
    expect(target.value).toBe(1);

    history.execute(new SetValueCommand(target, 4));
    expect(history.redo()).toBe(false);
    expect(target.value).toBe(4);
  });
});
