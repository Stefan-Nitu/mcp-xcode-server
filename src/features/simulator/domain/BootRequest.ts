import { DeviceId } from '../../../shared/domain/DeviceId.js';

/**
 * Value object representing a request to boot a simulator
 *
 * Encapsulates the device identifier (can be UUID or name)
 */
export class BootRequest {
  private constructor(
    public readonly deviceId: string
  ) {
    Object.freeze(this);
  }

  /**
   * Create a boot request from a DeviceId
   */
  static create(deviceId: DeviceId): BootRequest {
    return new BootRequest(deviceId.toString());
  }
}