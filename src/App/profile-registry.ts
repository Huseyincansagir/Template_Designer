import type { DeviceProfile } from "../Domain/models";

/**
 * UI-facing capability lookup. The registry owns profile discovery; the
 * editor does not know how profiles are loaded or which firmware owns them.
 */
export interface DeviceProfileRegistry {
  list(): readonly DeviceProfile[];
  get(profileId: string): DeviceProfile | undefined;
}

export class InMemoryDeviceProfileRegistry implements DeviceProfileRegistry {
  private readonly profilesById: ReadonlyMap<string, DeviceProfile>;

  constructor(profiles: readonly DeviceProfile[]) {
    this.profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  }

  list(): readonly DeviceProfile[] {
    return [...this.profilesById.values()];
  }

  get(profileId: string): DeviceProfile | undefined {
    return this.profilesById.get(profileId);
  }
}

export function createDeviceProfileRegistry(profiles: readonly DeviceProfile[]): DeviceProfileRegistry {
  return new InMemoryDeviceProfileRegistry(profiles);
}
