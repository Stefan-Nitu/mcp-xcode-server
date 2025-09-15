import { DomainEmptyError, DomainInvalidTypeError, DomainInvalidFormatError, DomainRequiredError } from '../errors/DomainError.js';

/**
 * Value object for an app bundle path
 * Ensures the path ends with .app extension
 */
export class AppPath {
  private constructor(private readonly value: string) {}

  static create(path: unknown): AppPath {
    // Required check (for undefined/null)
    if (path === undefined || path === null) {
      throw new AppPath.RequiredError();
    }

    // Type checking
    if (typeof path !== 'string') {
      throw new AppPath.InvalidTypeError(path);
    }

    // Empty check
    if (path.trim() === '') {
      throw new AppPath.EmptyError(path);
    }

    const trimmed = path.trim();

    // Security checks first (before format validation)
    if (trimmed.includes('..')) {
      throw new AppPath.TraversalError(trimmed);
    }

    if (trimmed.includes('\0')) {
      throw new AppPath.NullCharacterError(trimmed);
    }

    // Format validation
    if (!trimmed.endsWith('.app') && !trimmed.endsWith('.app/')) {
      throw new AppPath.InvalidFormatError(trimmed);
    }

    return new AppPath(trimmed);
  }

  toString(): string {
    return this.value;
  }

  get name(): string {
    // Handle both forward slash and backslash for cross-platform support
    const separatorPattern = /[/\\]/;
    const parts = this.value.split(separatorPattern);
    const lastPart = parts[parts.length - 1];

    // If path ends with /, the last part will be empty, so take the second to last
    return lastPart || parts[parts.length - 2];
  }
}

// Nested error classes under AppPath namespace
export namespace AppPath {
  // All AppPath errors extend DomainError for consistency

  export class RequiredError extends DomainRequiredError {
    constructor() {
      super('App path');
      this.name = 'AppPath.RequiredError';
    }
  }

  export class InvalidTypeError extends DomainInvalidTypeError {
    constructor(public readonly providedValue: unknown) {
      super('App path', 'string');
      this.name = 'AppPath.InvalidTypeError';
    }
  }

  export class EmptyError extends DomainEmptyError {
    constructor(public readonly providedValue: unknown) {
      super('App path');
      this.name = 'AppPath.EmptyError';
    }
  }

  export class InvalidFormatError extends DomainInvalidFormatError {
    constructor(public readonly path: string) {
      super('App path must end with .app');
      this.name = 'AppPath.InvalidFormatError';
    }
  }

  export class TraversalError extends DomainInvalidFormatError {
    constructor(public readonly path: string) {
      super('App path cannot contain directory traversal');
      this.name = 'AppPath.TraversalError';
    }
  }

  export class NullCharacterError extends DomainInvalidFormatError {
    constructor(public readonly path: string) {
      super('App path cannot contain null characters');
      this.name = 'AppPath.NullCharacterError';
    }
  }
}