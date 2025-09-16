import { DeviceId } from '../../../shared/domain/DeviceId.js';

/**
 * Value object representing a request to shutdown a simulator
 *
 * Encapsulates the device identifier (can be UUID or name)
 */
export class ShutdownRequest {
  private constructor(
    public readonly deviceId: string
  ) {
    Object.freeze(this);
  }

  /**
   * Create a shutdown request from a DeviceId
   */
  static create(deviceId: DeviceId): ShutdownRequest {
    return new ShutdownRequest(deviceId.toString());
  }
}