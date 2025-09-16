import { DomainEmptyError, DomainInvalidTypeError } from '../../domain/errors/DomainError.js';

/**
 * Value object for a device identifier
 * Can be either a device UDID or a device name
 * Works for both simulators and physical devices
 */
export class DeviceId {
  private constructor(private readonly value: string) {}

  static create(id: unknown): DeviceId {
    // Required check
    if (id === undefined || id === null) {
      throw new DeviceId.RequiredError();
    }

    // Type checking
    if (typeof id !== 'string') {
      throw new DeviceId.InvalidTypeError(id);
    }

    // Empty check
    if (id === '') {
      throw new DeviceId.EmptyError(id);
    }

    // Whitespace-only check
    if (id.trim() === '') {
      throw new DeviceId.WhitespaceOnlyError(id);
    }

    return new DeviceId(id.trim());
  }

  static createOptional(id: unknown): DeviceId | undefined {
    if (id === undefined || id === null) {
      return undefined;
    }
    return DeviceId.create(id);
  }

  toString(): string {
    return this.value;
  }

  equals(other: DeviceId): boolean {
    return this.value === other.value;
  }
}

// Nested error classes under DeviceId namespace
export namespace DeviceId {
  export class RequiredError extends Error {
    constructor() {
      super('Device ID is required');
      this.name = 'DeviceId.RequiredError';
    }
  }

  export class InvalidTypeError extends DomainInvalidTypeError {
    constructor(public readonly providedValue: unknown) {
      super('Device ID', 'string');
      this.name = 'DeviceId.InvalidTypeError';
    }
  }

  export class EmptyError extends DomainEmptyError {
    constructor(public readonly providedValue: unknown) {
      super('Device ID');
      this.name = 'DeviceId.EmptyError';
    }
  }

  export class WhitespaceOnlyError extends Error {
    constructor(public readonly providedValue: unknown) {
      super('Device ID cannot be whitespace only');
      this.name = 'DeviceId.WhitespaceOnlyError';
    }
  }
}