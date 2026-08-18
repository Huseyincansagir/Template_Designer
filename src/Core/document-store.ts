import type { Project } from "../Domain/models";
import type { ProjectStorage } from "../Infrastructure/project-storage";
import { CommandHistory, type Command, type CommandHistorySnapshot } from "./commands";
import { stableSerialize } from "./serialize";

export interface DocumentSnapshot {
  readonly project: Project | undefined;
  readonly isOpen: boolean;
  readonly isDirty: boolean;
  readonly history: CommandHistorySnapshot;
}

export interface DocumentStore {
  getCurrent(): Project | undefined;
  getSnapshot(): DocumentSnapshot;
  subscribe(listener: () => void): () => void;
  open(project: Project): void;
  create(project: Project): void;
  close(): void;
  save(): void;
  replaceCurrent(project: Project): void;
  execute(command: Command): void;
  undo(): boolean;
  redo(): boolean;
  readonly history: CommandHistory;
}

function serialize(project: Project | undefined): string {
  return project ? stableSerialize(project) : "";
}

export class InMemoryDocumentStore implements DocumentStore {
  private currentProject: Project | undefined;
  private savedProject: Project | undefined;
  private snapshot: DocumentSnapshot;
  private suppressSnapshotRefresh = false;
  private readonly listeners = new Set<() => void>();
  readonly history: CommandHistory;

  constructor(history = new CommandHistory(), private readonly storage?: ProjectStorage) {
    this.history = history;
    this.snapshot = {
      project: undefined,
      isOpen: false,
      isDirty: false,
      history: history.snapshot,
    };
    this.history.subscribe(() => {
      if (!this.suppressSnapshotRefresh) this.refreshSnapshot();
    });
  }

  getCurrent(): Project | undefined { return this.currentProject; }
  getSnapshot(): DocumentSnapshot { return this.snapshot; }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  open(project: Project): void {
    this.currentProject = project;
    this.savedProject = project;
    this.runWithoutSnapshotRefresh(() => this.history.clear());
    this.refreshSnapshot();
  }

  create(project: Project): void { this.open(project); }

  close(): void {
    this.currentProject = undefined;
    this.savedProject = undefined;
    this.runWithoutSnapshotRefresh(() => this.history.clear());
    this.refreshSnapshot();
  }

  save(): void {
    if (!this.currentProject) return;
    // Persistence failure must not be reported as "Saved": the baseline is
    // only updated after the adapter accepts the write.
    this.storage?.save(this.currentProject);
    this.savedProject = this.currentProject;
    this.refreshSnapshot();
  }

  replaceCurrent(project: Project): void {
    if (!this.currentProject) throw new Error("No document is open");
    this.currentProject = project;
    if (!this.suppressSnapshotRefresh) this.refreshSnapshot();
  }

  execute(command: Command): void {
    if (!this.currentProject) throw new Error("No document is open");
    try {
      this.runWithoutSnapshotRefresh(() => this.history.execute(command));
    } finally {
      this.refreshSnapshot();
    }
  }

  undo(): boolean {
    try {
      return this.runWithoutSnapshotRefresh(() => this.history.undo());
    } finally {
      this.refreshSnapshot();
    }
  }

  redo(): boolean {
    try {
      return this.runWithoutSnapshotRefresh(() => this.history.redo());
    } finally {
      this.refreshSnapshot();
    }
  }

  private runWithoutSnapshotRefresh<T>(operation: () => T): T {
    const previous = this.suppressSnapshotRefresh;
    this.suppressSnapshotRefresh = true;
    try {
      return operation();
    } finally {
      this.suppressSnapshotRefresh = previous;
    }
  }

  private refreshSnapshot(): void {
    this.snapshot = {
      project: this.currentProject,
      isOpen: Boolean(this.currentProject),
      isDirty: serialize(this.currentProject) !== serialize(this.savedProject),
      history: this.history.snapshot,
    };
    this.listeners.forEach((listener) => listener());
  }
}
