import { buildDeploymentPackage, verifyDeploymentPackage } from "./export";
import type { DeploymentPackage, DeploymentTarget, DeviceProfile, Project } from "../Domain/models";

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

export class PackageDeploymentManager implements DeploymentManager {
  constructor(
    private readonly profile: DeviceProfile,
    private readonly adapter: DeploymentTargetAdapter,
  ) {}

  async deploy(project: Project, target: DeploymentTarget): Promise<void> {
    if (target.id !== this.adapter.target.id) {
      throw new ApplicationError(
        `Deployment target '${target.id}' is not available through '${this.adapter.target.id}'.`,
        "DEPLOYMENT_TARGET_MISMATCH",
      );
    }

    const packageFile = await buildDeploymentPackage(project, this.profile);
    const verifiedPackage = await verifyDeploymentPackage(packageFile);
    if (!verifiedPackage.verified) {
      throw new ApplicationError(
        "Deployment package verification failed.",
        "DEPLOYMENT_PACKAGE_NOT_VERIFIED",
      );
    }

    await this.adapter.deploy(verifiedPackage);
  }
}
