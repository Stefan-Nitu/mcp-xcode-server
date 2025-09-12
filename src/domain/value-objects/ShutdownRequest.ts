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
   * Create a shutdown request with validation
   */
  static create(deviceId: string): ShutdownRequest {
    const trimmedId = deviceId?.trim();
    
    if (!trimmedId) {
      throw new Error('Device ID cannot be empty');
    }
    
    return new ShutdownRequest(trimmedId);
  }
}