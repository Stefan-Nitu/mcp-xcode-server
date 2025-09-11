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
   * Create a boot request with validation
   */
  static create(deviceId: string): BootRequest {
    const trimmedId = deviceId?.trim();
    
    if (!trimmedId) {
      throw new Error('Device ID cannot be empty');
    }
    
    return new BootRequest(trimmedId);
  }
}