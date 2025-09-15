/**
 * Base domain error classes that ensure consistent error messages
 * Each domain object can extend these for type-safe, consistent errors
 */

export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Common validation error patterns with consistent messages
export abstract class DomainEmptyError extends DomainError {
  constructor(fieldDisplayName: string) {
    super(`${fieldDisplayName} cannot be empty`);
  }
}

export abstract class DomainRequiredError extends DomainError {
  constructor(fieldDisplayName: string) {
    super(`${fieldDisplayName} is required`);
  }
}

export abstract class DomainInvalidTypeError extends DomainError {
  constructor(fieldDisplayName: string, expectedType: string) {
    super(`${fieldDisplayName} must be a ${expectedType}`);
  }
}

export abstract class DomainInvalidFormatError extends DomainError {
  // This one varies by context, so just pass the message
  constructor(message: string) {
    super(message);
  }
}