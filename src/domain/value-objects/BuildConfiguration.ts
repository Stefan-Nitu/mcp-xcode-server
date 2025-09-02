import { Platform } from './Platform.js';

/**
 * Value Object: Represents build configuration
 * Immutable configuration for a build operation
 */
export class BuildConfiguration {
  constructor(
    public readonly scheme: string | undefined,
    public readonly configuration: string,
    public readonly platform: Platform,
    public readonly deviceId: string | undefined,
    public readonly derivedDataPath: string
  ) {
    // Validate configuration
    if (!configuration) {
      throw new Error('Configuration cannot be empty');
    }
  }
  
  static default(derivedDataPath: string): BuildConfiguration {
    return new BuildConfiguration(
      undefined,
      'Debug',
      Platform.iOS,
      undefined,
      derivedDataPath
    );
  }
  
  withScheme(scheme: string): BuildConfiguration {
    return new BuildConfiguration(
      scheme,
      this.configuration,
      this.platform,
      this.deviceId,
      this.derivedDataPath
    );
  }
  
  withPlatform(platform: Platform): BuildConfiguration {
    return new BuildConfiguration(
      this.scheme,
      this.configuration,
      platform,
      this.deviceId,
      this.derivedDataPath
    );
  }
}