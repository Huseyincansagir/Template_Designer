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

export class CommandHistory {
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get snapshot(): CommandHistorySnapshot {
    return { canUndo: this.canUndo, canRedo: this.canRedo, undoCount: this.undoStack.length, redoCount: this.redoStack.length };
  }

  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack.length = 0;
    this.emit();
  }

  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;
    command.undo();
    this.redoStack.push(command);
    this.emit();
    return true;
  }

  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;
    command.execute();
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

  private emit(): void { this.listeners.forEach((listener) => listener()); }
}
