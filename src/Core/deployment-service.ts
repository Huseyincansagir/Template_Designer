import { buildDeploymentPackage, verifyDeploymentPackage } from "./export";
import { ApplicationError, type DeploymentTargetAdapter } from "./application";
import type { DeploymentPackage, DeploymentTarget, DeviceProfile, Project } from "../Domain/models";

/**
 * The application service the UI talks to for packaging and deployment.
 *
 * `AGENTS.md` mandates `UI -> Application Service -> Platform/Deployment
 * Adapter`, but the editor was calling `buildDeploymentPackage` directly, so the
 * adapter plane had no caller at all and `SDCardTarget` was imported by nothing.
 * The seam existed on paper only. Routing through this service makes it real:
 * the UI never learns which transport is configured, and an unavailable
 * transport reports its own reason instead of being silently absent.
 */
export type PackageBuildOutcome =
  | { readonly status: "built"; readonly package: DeploymentPackage }
  | { readonly status: "blocked"; readonly reason: string; readonly code: string };

export type DeploymentOutcome =
  | { readonly status: "written"; readonly target: DeploymentTarget }
  | { readonly status: "unavailable"; readonly reason: string; readonly code: string };

export class DeploymentService {
  constructor(private readonly adapters: readonly DeploymentTargetAdapter[] = []) {}

  /** Transports this build offers. Empty is a legitimate, reportable state. */
  targets(): readonly DeploymentTarget[] {
    return this.adapters.map((adapter) => adapter.target);
  }

  /**
   * Builds and verifies in one call, because a package the caller has not
   * verified must never be presented as deployable. Verification is still a
   * separate step inside: `buildDeploymentPackage` returns `verified: false` and
   * only `verifyDeploymentPackage` may set it true.
   */
  async buildVerified(project: Project, profile: DeviceProfile): Promise<PackageBuildOutcome> {
    try {
      const built = await buildDeploymentPackage(project, profile);
      const verified = await verifyDeploymentPackage(built);
      if (!verified.verified) {
        return { status: "blocked", reason: "The package checksum did not match after building.", code: "DEPLOYMENT_PACKAGE_NOT_VERIFIED" };
      }
      return { status: "built", package: verified };
    } catch (error) {
      if (error instanceof ApplicationError) return { status: "blocked", reason: error.message, code: error.code };
      // ExportBlockedError and anything else surface their own message; the
      // caller decides how to present it.
      return { status: "blocked", reason: error instanceof Error ? error.message : "Package build failed.", code: "EXPORT_FAILED" };
    }
  }

  /**
   * Hands a verified package to a transport. V1 registers the SD-card adapter,
   * which refuses with its own reason because the native write is not
   * implemented — that refusal is the honest answer, and it now reaches the UI
   * through the sanctioned chain rather than being invisible.
   */
  async write(packageFile: DeploymentPackage, targetId: string): Promise<DeploymentOutcome> {
    const adapter = this.adapters.find((candidate) => candidate.target.id === targetId);
    if (!adapter) {
      return { status: "unavailable", reason: `No deployment transport with id '${targetId}' is configured in this build.`, code: "DEPLOYMENT_TARGET_MISMATCH" };
    }
    if (!packageFile.verified) {
      return { status: "unavailable", reason: "Refusing to write a package that has not been verified.", code: "DEPLOYMENT_PACKAGE_NOT_VERIFIED" };
    }
    try {
      await adapter.deploy(packageFile);
      return { status: "written", target: adapter.target };
    } catch (error) {
      if (error instanceof ApplicationError) return { status: "unavailable", reason: error.message, code: error.code };
      return { status: "unavailable", reason: error instanceof Error ? error.message : "The deployment transport failed.", code: "DEPLOYMENT_FAILED" };
    }
  }
}

export function createDeploymentService(adapters: readonly DeploymentTargetAdapter[]): DeploymentService {
  return new DeploymentService(adapters);
}
