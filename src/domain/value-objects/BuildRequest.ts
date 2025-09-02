import { Platform } from './Platform.js';
import { ProjectPath } from './ProjectPath.js';
import { BuildConfiguration } from './BuildConfiguration.js';

/**
 * Domain Value Object: Represents a build request
 * This encapsulates all the data needed to perform a build
 */
export class BuildRequest {
  public readonly projectPath: ProjectPath;
  public readonly configuration: BuildConfiguration;
  
  constructor(args: {
    projectPath: string;
    scheme?: string;
    configuration?: string;
    platform?: Platform;
    deviceId?: string;
    derivedDataPath?: string;
  }) {
    // Create domain objects with validation
    this.projectPath = ProjectPath.create(args.projectPath);
    
    // BuildConfiguration handles its own defaults and validation
    this.configuration = new BuildConfiguration(
      args.scheme,
      args.configuration || 'Debug',
      args.platform || Platform.iOS,
      args.deviceId,
      args.derivedDataPath || ''  // Will be replaced by config provider
    );
  }
  
  get scheme(): string | undefined {
    return this.configuration.scheme;
  }
  
  get platform(): Platform {
    return this.configuration.platform;
  }
  
  get deviceId(): string | undefined {
    return this.configuration.deviceId;
  }
  
  get derivedDataPath(): string {
    return this.configuration.derivedDataPath;
  }
  
  /**
   * Update the derived data path (used by use case after getting from config)
   */
  withDerivedDataPath(path: string): BuildRequest {
    const updated = { ...this };
    Object.setPrototypeOf(updated, BuildRequest.prototype);
    (updated as any).configuration = this.configuration.withScheme(this.configuration.scheme || '')
      .withPlatform(this.configuration.platform);
    (updated as any).configuration = new BuildConfiguration(
      this.configuration.scheme,
      this.configuration.configuration,
      this.configuration.platform,
      this.configuration.deviceId,
      path
    );
    return updated;
  }
}