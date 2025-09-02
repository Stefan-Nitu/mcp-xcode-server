/**
 * Domain Value Object: Supported build platforms
 * This is a core domain concept, not an external dependency
 */
export enum Platform {
  iOS = 'iOS',
  macOS = 'macOS',
  tvOS = 'tvOS',
  watchOS = 'watchOS',
  visionOS = 'visionOS'
}

/**
 * Platform-related domain logic
 */
export class PlatformInfo {
  constructor(private readonly platform: Platform) {}
  
  /**
   * Check if this platform requires a simulator
   */
  requiresSimulator(): boolean {
    return this.platform === Platform.iOS || 
           this.platform === Platform.tvOS || 
           this.platform === Platform.watchOS ||
           this.platform === Platform.visionOS;
  }
  
  /**
   * Check if this platform runs on mac directly
   */
  isNativeMac(): boolean {
    return this.platform === Platform.macOS;
  }
  
  toString(): string {
    return this.platform;
  }
}