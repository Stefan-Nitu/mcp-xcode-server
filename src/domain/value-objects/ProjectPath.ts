import { existsSync } from 'fs';
import path from 'path';
import { DomainEmptyError, DomainInvalidTypeError, DomainInvalidFormatError, DomainRequiredError } from '../errors/DomainError.js';

/**
 * Value Object: Represents a validated project path
 * Ensures the path exists and is a valid Xcode project or workspace
 */
export class ProjectPath {
  private constructor(private readonly value: string) {}

  static create(pathString: unknown): ProjectPath {
    // Required check (for undefined/null)
    if (pathString === undefined || pathString === null) {
      throw new ProjectPath.RequiredError();
    }

    // Type checking
    if (typeof pathString !== 'string') {
      throw new ProjectPath.InvalidTypeError(pathString);
    }

    // Empty check
    if (pathString.trim() === '') {
      throw new ProjectPath.EmptyError(pathString);
    }

    const trimmed = pathString.trim();

    // Format validation
    const ext = path.extname(trimmed);
    if (ext !== '.xcodeproj' && ext !== '.xcworkspace') {
      throw new ProjectPath.InvalidFormatError(trimmed);
    }

    // Runtime check - this stays as a regular Error since it's not validation
    if (!existsSync(trimmed)) {
      throw new Error(`Project path does not exist: ${trimmed}`);
    }

    return new ProjectPath(trimmed);
  }
  
  toString(): string {
    return this.value;
  }
  
  get name(): string {
    return path.basename(this.value, path.extname(this.value));
  }
  
  get isWorkspace(): boolean {
    return path.extname(this.value) === '.xcworkspace';
  }
}

// Nested error classes under ProjectPath namespace
export namespace ProjectPath {
  export class RequiredError extends DomainRequiredError {
    constructor() {
      super('Project path');
      this.name = 'ProjectPath.RequiredError';
    }
  }

  export class InvalidTypeError extends DomainInvalidTypeError {
    constructor(public readonly providedValue: unknown) {
      super('Project path', 'string');
      this.name = 'ProjectPath.InvalidTypeError';
    }
  }

  export class EmptyError extends DomainEmptyError {
    constructor(public readonly providedValue: unknown) {
      super('Project path');
      this.name = 'ProjectPath.EmptyError';
    }
  }

  export class InvalidFormatError extends DomainInvalidFormatError {
    constructor(public readonly path: string) {
      super('Project path must be an .xcodeproj or .xcworkspace file');
      this.name = 'ProjectPath.InvalidFormatError';
    }
  }
}