/**
 * Platform-specific configuration and handling
 * Implements Open/Closed Principle - open for extension, closed for modification
 */

import { Platform, PlatformConfig } from './types.js';

export class PlatformHandler {
  private static platformConfigs: Map<Platform, PlatformConfig> = new Map([
    [Platform.iOS, {
      platform: Platform.iOS,
      needsSimulator: true,
      defaultDevice: 'iPhone 16 Pro',
      destinationString: (deviceName?: string) => 
        `platform=iOS Simulator,name=${deviceName || 'iPhone 16 Pro'}`
    }],
    
    [Platform.macOS, {
      platform: Platform.macOS,
      needsSimulator: false,
      destinationString: () => 'platform=macOS'
    }],
    
    [Platform.tvOS, {
      platform: Platform.tvOS,
      needsSimulator: true,
      defaultDevice: 'Apple TV',
      destinationString: (deviceName?: string) => 
        `platform=tvOS Simulator,name=${deviceName || 'Apple TV'}`
    }],
    
    [Platform.watchOS, {
      platform: Platform.watchOS,
      needsSimulator: true,
      defaultDevice: 'Apple Watch Series 10 (46mm)',
      destinationString: (deviceName?: string) => 
        `platform=watchOS Simulator,name=${deviceName || 'Apple Watch Series 10 (46mm)'}`
    }],
    
    [Platform.visionOS, {
      platform: Platform.visionOS,
      needsSimulator: true,
      defaultDevice: 'Apple Vision Pro',
      destinationString: (deviceName?: string) => 
        `platform=visionOS Simulator,name=${deviceName || 'Apple Vision Pro'}`
    }]
  ]);

  static getConfig(platform: Platform): PlatformConfig {
    const config = this.platformConfigs.get(platform);
    if (!config) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    return config;
  }

  static needsSimulator(platform: Platform): boolean {
    return this.getConfig(platform).needsSimulator;
  }

  static getDestination(platform: Platform, deviceName?: string): string {
    const config = this.getConfig(platform);
    return config.destinationString(deviceName);
  }

  static getDefaultDevice(platform: Platform): string | undefined {
    return this.getConfig(platform).defaultDevice;
  }

  static getGenericDestination(platform: Platform): string {
    // Use generic destinations that don't require booting a specific simulator
    switch (platform) {
      case Platform.iOS:
        return 'generic/platform=iOS Simulator';
      case Platform.tvOS:
        return 'generic/platform=tvOS Simulator';
      case Platform.watchOS:
        return 'generic/platform=watchOS Simulator';
      case Platform.visionOS:
        return 'generic/platform=visionOS Simulator';
      case Platform.macOS:
        return 'platform=macOS';
      default:
        // Fallback to specific destination
        return this.getDestination(platform);
    }
  }

  static parsePlatformFromString(platformStr: string): Platform {
    const normalizedStr = platformStr.toLowerCase();
    
    // Map common variations to proper platform
    const platformMap: Record<string, Platform> = {
      'ios': Platform.iOS,
      'iphonesimulator': Platform.iOS,
      'iphoneos': Platform.iOS,
      'macos': Platform.macOS,
      'mac': Platform.macOS,
      'osx': Platform.macOS,
      'tvos': Platform.tvOS,
      'appletv': Platform.tvOS,
      'watchos': Platform.watchOS,
      'watch': Platform.watchOS,
      'visionos': Platform.visionOS,
      'vision': Platform.visionOS,
      'xros': Platform.visionOS
    };

    const platform = platformMap[normalizedStr];
    if (!platform) {
      throw new Error(`Unknown platform: ${platformStr}`);
    }
    
    return platform;
  }
}