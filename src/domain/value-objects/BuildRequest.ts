import { BuildDestination } from './BuildDestination.js';
import { ProjectPath } from './ProjectPath.js';
import { DomainEmptyError, DomainInvalidTypeError } from '../errors/DomainError.js';

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
  private constructor(
    public readonly projectPath: ProjectPath,
    public readonly scheme: string,
    public readonly configuration: string,
    public readonly destination: BuildDestination,
    public readonly derivedDataPath: string
  ) {}

  /**
   * Create a BuildRequest from raw inputs
   */
  static create(
    projectPath: unknown,
    scheme: unknown,
    destination: unknown,
    configuration: unknown = 'Debug',
    derivedDataPath: unknown = ''
  ): BuildRequest {
    // Validate project path using ProjectPath value object
    const validatedProjectPath = ProjectPath.create(projectPath);

    // Validate scheme
    if (scheme === undefined || scheme === null) {
      throw new BuildRequest.RequiredSchemeError();
    }
    if (typeof scheme !== 'string') {
      throw new BuildRequest.InvalidSchemeTypeError(scheme);
    }
    if (scheme.trim() === '') {
      throw new BuildRequest.EmptySchemeError(scheme);
    }
    const trimmedScheme = scheme.trim();

    // Validate configuration
    if (typeof configuration !== 'string') {
      throw new BuildRequest.InvalidConfigurationTypeError(configuration);
    }
    if (!configuration || configuration.trim() === '') {
      throw new BuildRequest.EmptyConfigurationError(configuration);
    }
    const trimmedConfig = configuration.trim();

    // Validate destination
    if (typeof destination !== 'string') {
      throw new BuildRequest.InvalidDestinationTypeError(destination);
    }
    const validDestinations = Object.values(BuildDestination) as string[];
    if (!validDestinations.includes(destination)) {
      throw new BuildRequest.InvalidDestinationError(destination, validDestinations);
    }

    // Validate derived data path
    if (typeof derivedDataPath !== 'string') {
      throw new BuildRequest.InvalidDerivedDataPathTypeError(derivedDataPath);
    }
    const trimmedDerivedPath = derivedDataPath.trim();
    if (!trimmedDerivedPath) {
      throw new BuildRequest.EmptyDerivedDataPathError(derivedDataPath);
    }

    return new BuildRequest(
      validatedProjectPath,
      trimmedScheme,
      trimmedConfig,
      destination as BuildDestination,
      trimmedDerivedPath
    );
  }
}

// Nested error classes under BuildRequest namespace
export namespace BuildRequest {
  // Base error for all BuildRequest errors
  export abstract class Error extends globalThis.Error {}

  export class RequiredSchemeError extends Error {
    constructor() {
      super('Scheme is required');
      this.name = 'BuildRequest.RequiredSchemeError';
    }
  }

  export class InvalidSchemeTypeError extends DomainInvalidTypeError {
    constructor(public readonly providedValue: unknown) {
      super('Scheme', 'string');
      this.name = 'BuildRequest.InvalidSchemeTypeError';
    }
  }

  export class EmptySchemeError extends DomainEmptyError {
    constructor(public readonly providedValue: unknown) {
      super('Scheme');
      this.name = 'BuildRequest.EmptySchemeError';
    }
  }

  export class InvalidConfigurationTypeError extends DomainInvalidTypeError {
    constructor(public readonly providedValue: unknown) {
      super('Configuration', 'string');
      this.name = 'BuildRequest.InvalidConfigurationTypeError';
    }
  }

  export class EmptyConfigurationError extends DomainEmptyError {
    constructor(public readonly providedValue: unknown) {
      super('Configuration');
      this.name = 'BuildRequest.EmptyConfigurationError';
    }
  }

  export class InvalidDestinationTypeError extends DomainInvalidTypeError {
    constructor(public readonly providedValue: unknown) {
      super('Destination', 'string');
      this.name = 'BuildRequest.InvalidDestinationTypeError';
    }
  }

  export class InvalidDestinationError extends Error {
    constructor(
      public readonly providedValue: unknown,
      public readonly validValues: string[]
    ) {
      super('Invalid destination. Use format: [platform][Simulator|Device|SimulatorUniversal]');
      this.name = 'BuildRequest.InvalidDestinationError';
    }
  }

  export class InvalidDerivedDataPathTypeError extends DomainInvalidTypeError {
    constructor(public readonly providedValue: unknown) {
      super('Derived data path', 'string');
      this.name = 'BuildRequest.InvalidDerivedDataPathTypeError';
    }
  }

  export class EmptyDerivedDataPathError extends DomainEmptyError {
    constructor(public readonly providedValue: unknown) {
      super('Derived data path');
      this.name = 'BuildRequest.EmptyDerivedDataPathError';
    }
  }
}