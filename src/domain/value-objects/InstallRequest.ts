import { AppPath } from './AppPath.js';
import { DeviceId } from './DeviceId.js';

/**
 * Domain Value Object: Represents an app installation request
 *
 * Contains all the data needed to install an app:
 * - What: appPath (the .app bundle to install)
 * - Where: simulatorId (optional - uses booted simulator if not specified)
 */
export class InstallRequest {
  private constructor(
    public readonly appPath: AppPath,
    public readonly simulatorId?: DeviceId
  ) {}

  /**
   * Create an InstallRequest from raw inputs
   * Validates the inputs and creates an immutable request object
   */
  static create(
    appPath: unknown,
    simulatorId?: unknown
  ): InstallRequest {
    // Validate app path using AppPath value object
    const validatedAppPath = AppPath.create(appPath);

    // Validate simulator ID if provided
    const validatedDeviceId = DeviceId.createOptional(simulatorId);

    return new InstallRequest(validatedAppPath, validatedDeviceId);
  }
}