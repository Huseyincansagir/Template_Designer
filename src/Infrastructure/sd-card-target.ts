import type { DeploymentPackage, DeploymentTarget } from "../Domain/models";
import { ApplicationError, type DeploymentTargetAdapter } from "../Core/application";

export class SDCardTarget implements DeploymentTargetAdapter {
  readonly target: DeploymentTarget = {
    id: "sd-card",
    kind: "sd-card",
    displayName: "SD Card",
  };

  async deploy(_packageFile: DeploymentPackage): Promise<void> {
    throw new ApplicationError(
      "SD-card deployment is reserved for a later phase.",
      "SD_CARD_DEPLOYMENT_NOT_IMPLEMENTED",
    );
  }
}
