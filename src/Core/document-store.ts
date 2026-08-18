import type { Project } from "../Domain/models";
import { CommandHistory, type Command, type CommandHistorySnapshot } from "./commands";

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
  return project ? JSON.stringify(project) : "";
}

export class InMemoryDocumentStore implements DocumentStore {
  private currentProject: Project | undefined;
  private savedProject: Project | undefined;
  private readonly listeners = new Set<() => void>();
  readonly history: CommandHistory;

  constructor(history = new CommandHistory()) {
    this.history = history;
    this.history.subscribe(() => this.emit());
  }

  getCurrent(): Project | undefined { return this.currentProject; }

  getSnapshot(): DocumentSnapshot {
    return {
      project: this.currentProject,
      isOpen: Boolean(this.currentProject),
      isDirty: serialize(this.currentProject) !== serialize(this.savedProject),
      history: this.history.snapshot,
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  open(project: Project): void {
    this.currentProject = project;
    this.savedProject = project;
    this.history.clear();
    this.emit();
  }

  create(project: Project): void { this.open(project); }

  close(): void {
    this.currentProject = undefined;
    this.savedProject = undefined;
    this.history.clear();
    this.emit();
  }

  save(): void {
    this.savedProject = this.currentProject;
    this.emit();
  }

  replaceCurrent(project: Project): void {
    if (!this.currentProject) throw new Error("No document is open");
    this.currentProject = project;
    this.emit();
  }

  execute(command: Command): void {
    if (!this.currentProject) throw new Error("No document is open");
    this.history.execute(command);
  }

  undo(): boolean { return this.history.undo(); }
  redo(): boolean { return this.history.redo(); }

  private emit(): void { this.listeners.forEach((listener) => listener()); }
}
