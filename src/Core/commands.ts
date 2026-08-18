export interface Command {
  readonly label: string;
  execute(): void;
  undo(): void;
}

export interface CommandHistorySnapshot {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoCount: number;
  readonly redoCount: number;
}

export const DEFAULT_HISTORY_LIMIT = 100;

export class CommandHistory {
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];
  private readonly listeners = new Set<() => void>();

  constructor(private readonly limit = DEFAULT_HISTORY_LIMIT) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get snapshot(): CommandHistorySnapshot {
    return {
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
    };
  }

  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    // Bounded memory: each entry retains a full project snapshot, so the
    // stack is capped and the oldest commands are evicted.
    while (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
    this.emit();
  }

  undo(): boolean {
    const command = this.undoStack[this.undoStack.length - 1];
    if (!command) return false;

    command.undo();
    this.undoStack.pop();
    this.redoStack.push(command);
    this.emit();
    return true;
  }

  redo(): boolean {
    const command = this.redoStack[this.redoStack.length - 1];
    if (!command) return false;

    command.execute();
    this.redoStack.pop();
    this.undoStack.push(command);
    this.emit();
    return true;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.emit();
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}
