import type { Project } from "../Domain/models";

export interface DocumentStore {
  getCurrent(): Project | undefined;
  open(project: Project): void;
  close(): void;
}

export class InMemoryDocumentStore implements DocumentStore {
  private currentProject: Project | undefined;

  getCurrent(): Project | undefined {
    return this.currentProject;
  }

  open(project: Project): void {
    this.currentProject = project;
  }

  close(): void {
    this.currentProject = undefined;
  }
}
