import type { DeploymentPackage, DeploymentTarget, Project } from "../Domain/models";

export interface Logger {
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}

export interface DeploymentTargetAdapter {
  readonly target: DeploymentTarget;
  deploy(packageFile: DeploymentPackage): Promise<void>;
}

export interface DeploymentManager {
  deploy(project: Project, target: DeploymentTarget): Promise<void>;
}

export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApplicationError";
  }
}

export class ConsoleLogger implements Logger {
  info(message: string, context?: Readonly<Record<string, unknown>>): void {
    console.info(message, context);
  }

  warn(message: string, context?: Readonly<Record<string, unknown>>): void {
    console.warn(message, context);
  }

  error(message: string, context?: Readonly<Record<string, unknown>>): void {
    console.error(message, context);
  }
}

export class UnsupportedDeploymentManager implements DeploymentManager {
  async deploy(_project: Project, _target: DeploymentTarget): Promise<void> {
    throw new ApplicationError(
      "Deployment adapters are not configured in the foundation.",
      "DEPLOYMENT_ADAPTER_NOT_CONFIGURED",
    );
  }
}
