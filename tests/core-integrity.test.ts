import { describe, expect, it } from "vitest";
import { CommandHistory, DEFAULT_HISTORY_LIMIT } from "../src/Core/commands";
import { InMemoryDocumentStore } from "../src/Core/document-store";
import { createEmptyProject } from "../src/Domain/factories";
import type { Project } from "../src/Domain/models";

function reordered(project: Project): Project {
  // Same content, different key insertion order - the shape JSON.stringify's
  // dirty comparison used to be sensitive to.
  //
  // Built by REVERSING the real entries rather than listing keys by hand: the
  // hand-written version silently dropped a field added to Project later, so
  // the "reordered" copy differed in content and the test failed for the wrong
  // reason. Deriving the copy keeps it honest as the domain grows.
  return Object.fromEntries(Object.entries(project).reverse()) as Project;
}

describe("Core integrity", () => {
  it("bounds the undo stack at the configured history limit", () => {
    const history = new CommandHistory(3);
    let value = 0;
    for (let step = 1; step <= 5; step += 1) {
      history.execute({ label: `Step ${step}`, execute: () => { value = step; }, undo: () => { value = step - 1; } });
    }
    expect(history.snapshot.undoCount).toBe(3);
    // Evicted commands cannot be undone beyond the window.
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(false);
    expect(value).toBe(2);
  });

  it("uses the default history limit when none is supplied", () => {
    const history = new CommandHistory();
    for (let step = 0; step < DEFAULT_HISTORY_LIMIT + 5; step += 1) {
      history.execute({ label: `Step ${step}`, execute: () => {}, undo: () => {} });
    }
    expect(history.snapshot.undoCount).toBe(DEFAULT_HISTORY_LIMIT);
  });

  it("treats key-order differences as identical for dirty-state comparison", () => {
    const store = new InMemoryDocumentStore();
    const original = createEmptyProject("Order Test");
    store.open(original);
    expect(store.getSnapshot().isDirty).toBe(false);

    store.replaceCurrent(reordered(original));
    expect(store.getSnapshot().isDirty).toBe(false);
  });
});
