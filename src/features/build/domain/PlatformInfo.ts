/**
 * Domain Value Object: Platform information and behavior
 * Implements a pattern similar to Swift enums with associated values
 * Each platform is a singleton instance with its own behavior
 */

import { Platform } from '../../../shared/domain/Platform.js';

export class PlatformInfo {
  // Static instances - like Swift enum cases
  static readonly iOS = new PlatformInfo(Platform.iOS, true, 'iOS');
  static readonly macOS = new PlatformInfo(Platform.macOS, false, 'macOS');
  static readonly tvOS = new PlatformInfo(Platform.tvOS, true, 'tvOS');
  static readonly watchOS = new PlatformInfo(Platform.watchOS, true, 'watchOS');
  static readonly visionOS = new PlatformInfo(Platform.visionOS, true, 'xrOS'); // xrOS is internal name

  // Platform name aliases for parsing
  private static readonly aliases: Record<string, PlatformInfo> = {
    'ios': PlatformInfo.iOS,
    'iphonesimulator': PlatformInfo.iOS,
    'iphoneos': PlatformInfo.iOS,
    'macos': PlatformInfo.macOS,
    'mac': PlatformInfo.macOS,
    'osx': PlatformInfo.macOS,
    'tvos': PlatformInfo.tvOS,
    'appletv': PlatformInfo.tvOS,
    'watchos': PlatformInfo.watchOS,
    'watch': PlatformInfo.watchOS,
    'visionos': PlatformInfo.visionOS,
    'vision': PlatformInfo.visionOS,
    'xros': PlatformInfo.visionOS
  } as const;

  private constructor(
    private readonly platform: Platform,
    private readonly needsSimulator: boolean,
    private readonly internalName: string
  ) {}

  /**
   * Get PlatformInfo from Platform enum value
   */
  static fromPlatform(platform: Platform): PlatformInfo {
    switch (platform) {
      case Platform.iOS: return PlatformInfo.iOS;
      case Platform.macOS: return PlatformInfo.macOS;
      case Platform.tvOS: return PlatformInfo.tvOS;
      case Platform.watchOS: return PlatformInfo.watchOS;
      case Platform.visionOS: return PlatformInfo.visionOS;
    }
  }

  /**
   * Parse a platform from string representation
   * @throws Error if platform string is unknown
   */
  static parse(platformStr: string): PlatformInfo {
    // Check if it's a valid Platform enum value
    if (Object.values(Platform).includes(platformStr as Platform)) {
      return PlatformInfo.fromPlatform(platformStr as Platform);
    }

    // Check aliases (case-insensitive)
    const normalized = platformStr.toLowerCase();
    const platform = PlatformInfo.aliases[normalized];
    if (!platform) {
      throw new Error(`Unknown platform: ${platformStr}`);
    }
    return platform;
  }

  /**
   * Check if this platform requires a simulator
   */
  requiresSimulator(): boolean {
    return this.needsSimulator;
  }

  /**
   * Check if this platform runs on mac directly
   */
  isNativeMac(): boolean {
    return !this.needsSimulator;
  }

  /**
   * Get the platform name as used internally by xcodebuild
   */
  getInternalName(): string {
    return this.internalName;
  }

  /**
   * Generate destination string for xcodebuild
   * @param deviceIdentifier Optional device name or UUID. If not provided, uses generic destination
   * @throws Error if deviceIdentifier is invalid
   */
  generateDestination(deviceIdentifier?: string): string {
    // Validate input
    if (deviceIdentifier !== undefined && typeof deviceIdentifier !== 'string') {
      throw new Error('Device identifier must be a string or undefined');
    }
    
    if (typeof deviceIdentifier === 'string' && deviceIdentifier.trim() === '') {
      throw new Error('Device identifier cannot be empty');
    }

    const platformName = this.internalName;
    
    // macOS doesn't use device identifiers
    if (!this.needsSimulator) {
      return `platform=${platformName}`;
    }

    // Use generic destination if no identifier provided
    if (deviceIdentifier === undefined) {
      return `generic/platform=${platformName} Simulator`;
    }

    // Determine if it's a UUID or name
    const key = PlatformInfo.isUUID(deviceIdentifier) ? 'id' : 'name';
    return `platform=${platformName} Simulator,${key}=${deviceIdentifier}`;
  }

  /**
   * Generate generic destination for builds without specific device
   */
  generateGenericDestination(): string {
    const platformName = this.internalName;
    
    if (!this.needsSimulator) {
      return `platform=${platformName}`;
    }
    
    return `generic/platform=${platformName} Simulator`;
  }

  /**
   * Check if a string is a valid UUID format
   */
  private static isUUID(str: string): boolean {
    return /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(str);
  }

  toString(): string {
    return this.platform;
  }

  /**
   * Get the platform enum value
   */
  getValue(): Platform {
    return this.platform;
  }
}