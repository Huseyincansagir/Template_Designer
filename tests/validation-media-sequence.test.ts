import { describe, expect, it } from "vitest";
import { CommandHistory } from "../src/Core/commands";
import { InMemoryDocumentStore } from "../src/Core/document-store";
import { createEditorApplication } from "../src/Core/editor-application";
import { validateProject } from "../src/Core/validation";
import { createEmptyProject, foundationDeviceProfile } from "../src/Domain/factories";
import type { Widget } from "../src/Domain/models";

function mediaWidget(): Widget {
  return {
    id: "w1",
    name: "w1",
    widgetType: "media",
    enabled: true,
    visible: true,
    locked: false,
    geometry: { x: 10, y: 10, width: 100, height: 40 },
    zIndex: 1,
    bindings: [],
    assetIds: [],
  };
}

describe("Media sequence asset references (PD-02)", () => {
  it("treats a sequence entry as a referenced asset for format rules", () => {
    const base = createEmptyProject("Seq");
    const theme = base.themeProjectGroups[0].themeProjects[0];
    const [first, ...rest] = theme.rotations;
    const project = {
      ...base,
      themeProjectGroups: [{
        ...base.themeProjectGroups[0],
        themeProjects: [{
          ...theme,
          rotations: [
            { ...first, scenes: [{ id: "s1", name: "S", widgets: [mediaWidget()], priority: 0, activationConditions: [] }] },
            ...rest,
          ],
        }],
      }],
    };
    const store = new InMemoryDocumentStore(new CommandHistory());
    store.open(project);
    const editor = createEditorApplication(store);
    const assetId = editor.addAssets([{ name: "Notes", sourcePath: "assets/notes.txt", mediaType: "image" }]).createdIds?.[0] as string;

    const resting = validateProject(store.getCurrent()!, foundationDeviceProfile);
    expect(resting.issues.find((issue) => issue.code === "ASSET_FORMAT_UNSUPPORTED")?.severity).toBe("warning");
    expect(resting.valid).toBe(true);

    expect(editor.setWidgetConfiguration("s1", "w1", {
      mediaSlide: { items: [{ id: "mi", mediaType: "image", assetId, duration: 1 }] },
    }).changed).toBe(true);

    const referenced = validateProject(store.getCurrent()!, foundationDeviceProfile);
    expect(referenced.issues.find((issue) => issue.code === "ASSET_FORMAT_UNSUPPORTED")?.severity).toBe("error");
    expect(referenced.valid).toBe(false);
  });
});
