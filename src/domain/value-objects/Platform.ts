/**
 * Domain Value Object: Platform enum
 * Represents the supported Apple platforms
 */
export enum Platform {
  iOS = 'iOS',
  macOS = 'macOS',
  tvOS = 'tvOS',
  watchOS = 'watchOS',
  visionOS = 'visionOS'
}

/**
 * Platform validation and parsing utilities
 */
export namespace Platform {
  /**
   * Parse a string into a Platform enum value
   * @throws Error if the string is not a valid platform
   */
  export function parse(value: unknown): Platform {
    // Type check
    if (typeof value !== 'string') {
      throw new InvalidTypeError(value);
    }

    // Check if valid platform - filter out namespace functions
    const validPlatforms = Object.values(Platform).filter(v => typeof v === 'string') as string[];
    if (!validPlatforms.includes(value)) {
      throw new InvalidPlatformError(value, validPlatforms);
    }

    return value as Platform;
  }

  /**
   * Parse a string into a Platform enum value or return undefined
   */
  export function parseOptional(value: unknown): Platform | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return parse(value);
  }

  // Error classes
  export class InvalidTypeError extends Error {
    constructor(public readonly providedValue: unknown) {
      const validValues = Object.values(Platform).filter(v => typeof v === 'string') as string[];
      super(`Platform must be a string (one of: ${validValues.join(', ')}), got ${typeof providedValue}`);
      this.name = 'Platform.InvalidTypeError';
    }
  }

  export class InvalidPlatformError extends Error {
    constructor(
      public readonly providedValue: unknown,
      public readonly validValues: string[]
    ) {
      super(`Invalid platform: ${providedValue}. Valid values are: ${validValues.join(', ')}`);
      this.name = 'Platform.InvalidPlatformError';
    }
  }
}