import { BuildDestination } from './BuildDestination.js';
import { ProjectPath } from './ProjectPath.js';

/**
 * Domain Value Object: Represents a build request
 * 
 * Contains all the data needed to perform a build:
 * - Where: projectPath
 * - What: scheme
 * - How: configuration (Debug, Release, Beta, etc.)
 * - Target: destination (iOS, macOS, device, simulator, etc.)
 * - Output: derivedDataPath
 */
export class BuildRequest {
  constructor(
    public readonly projectPath: ProjectPath,
    public readonly scheme: string,
    public readonly configuration: string,
    public readonly destination: BuildDestination,
    public readonly derivedDataPath: string
  ) {
    // Validate at construction - fail fast
    if (!scheme || scheme.trim() === '') {
      throw new Error('Scheme cannot be empty');
    }
    if (!configuration || configuration.trim() === '') {
      throw new Error('Configuration cannot be empty');
    }
    if (!derivedDataPath || derivedDataPath.trim() === '') {
      throw new Error('Derived data path cannot be empty');
    }
  }
  
  /**
   * Create a BuildRequest from raw inputs
   */
  static create(
    projectPath: string,
    scheme: string,
    destination: BuildDestination,
    configuration: string = 'Debug',
    derivedDataPath: string = ''
  ): BuildRequest {
    return new BuildRequest(
      ProjectPath.create(projectPath),
      scheme,
      configuration,
      destination,
      derivedDataPath
    );
  }
}