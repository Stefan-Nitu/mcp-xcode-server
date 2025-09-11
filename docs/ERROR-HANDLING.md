# Error Handling and Presentation Patterns

## Overview

This document describes the error handling patterns and presentation conventions used across the MCP Xcode Server codebase. Following these patterns ensures consistent user experience and maintainable error handling.

## Core Principles

### 1. Separation of Concerns
- **Domain Layer**: Creates typed error objects with data only (no formatting)
- **Use Cases**: Return domain errors without formatting messages
- **Presentation Layer**: Formats errors for user display with consistent styling

### 2. Typed Domain Errors
Each domain has its own error types that extend a base error class:

```typescript
// Base class for domain-specific errors
export abstract class BootError extends Error {}

// Specific error types with relevant data
export class SimulatorNotFoundError extends BootError {
  constructor(public readonly deviceId: string) {
    super(deviceId); // Just store the data, no formatting
    this.name = 'SimulatorNotFoundError';
  }
}

export class BootCommandFailedError extends BootError {
  constructor(public readonly stderr: string) {
    super(stderr); // Just store the stderr output
    this.name = 'BootCommandFailedError';
  }
}
```

### 3. Error Type Checking
Use `instanceof` to check error types in the presentation layer:

```typescript
if (error instanceof SimulatorNotFoundError) {
  return `❌ Simulator not found: ${error.deviceId}`;
}

if (error instanceof BootCommandFailedError) {
  return `❌ ${ErrorFormatter.format(error)}`;
}
```

## Presentation Patterns

### Visual Indicators (Emojis)

All tools use consistent emoji prefixes for different outcomes:

- **✅ Success**: Successful operations
- **❌ Error**: Failed operations  
- **⚠️ Warning**: Operations with warnings
- **📁 Info**: Additional information (like log paths)

Examples:
```
✅ Successfully booted simulator: iPhone 15 (ABC123)
✅ Build succeeded: MyApp

❌ Simulator not found: iPhone-16
❌ Build failed

⚠️ Warnings (3):
  • Deprecated API usage
  • Unused variable 'x'
  
📁 Full logs saved to: /path/to/logs
```

### Error Message Format

1. **Simple Errors**: Direct message with emoji
   ```
   ❌ Simulator not found: iPhone-16
   ❌ Unable to boot device
   ```

2. **Complex Errors** (builds, tests): Structured format
   ```
   ❌ Build failed: MyApp
   Platform: iOS
   Configuration: Debug
   
   ❌ Errors (3):
     • /path/file.swift:10: Cannot find type 'Foo'
     • /path/file.swift:20: Missing return statement
   ```

### ErrorFormatter Usage

The `ErrorFormatter` class provides consistent error formatting across all tools:

```typescript
import { ErrorFormatter } from '../formatters/ErrorFormatter.js';

// In controller or presenter
const message = ErrorFormatter.format(error);
return `❌ ${message}`;
```

The ErrorFormatter:
- Handles Zod validation errors
- Formats build issues  
- Cleans up common error prefixes
- Provides fallback for unknown errors

## Implementation Guidelines

### Controllers

Controllers should format results consistently:

```typescript
private formatResult(result: DomainResult): string {
  switch (result.outcome) {
    case Outcome.Success:
      return `✅ Successfully completed: ${result.name}`;
      
    case Outcome.Failed:
      if (result.error instanceof SpecificError) {
        return `❌ Specific error: ${result.error.details}`;
      }
      return `❌ ${ErrorFormatter.format(result.error)}`;
  }
}
```

### Use Cases

Use cases should NOT format error messages:

```typescript
// ❌ BAD: Formatting in use case
return Result.failed(
  `Simulator not found: ${deviceId}` // Don't format here!
);

// ✅ GOOD: Return typed error
return Result.failed(
  new SimulatorNotFoundError(deviceId) // Just the error object
);
```

### Presenters

For complex formatting (like build results), use a dedicated presenter:

```typescript
export class BuildXcodePresenter {
  presentError(error: Error): MCPResponse {
    const message = ErrorFormatter.format(error);
    return {
      content: [{
        type: 'text',
        text: `❌ ${message}`
      }]
    };
  }
}
```

## Testing Error Handling

### Unit Tests

Test that controllers format errors correctly:

```typescript
it('should handle boot failure', async () => {
  // Arrange
  const error = new BootCommandFailedError('Device is locked');
  const result = BootResult.failed('123', 'iPhone', error);
  
  // Act
  const response = controller.execute({ deviceId: 'iPhone' });
  
  // Assert - Check for emoji and message
  expect(response.text).toBe('❌ Device is locked');
});
```

### Integration Tests

Test behavior, not specific formatting:

```typescript
it('should handle simulator not found', async () => {
  // Act
  const result = await controller.execute({ deviceId: 'NonExistent' });
  
  // Assert - Test behavior: error message shown
  expect(result.content[0].text).toContain('❌');
  expect(result.content[0].text).toContain('not found');
});
```

## Common Error Scenarios

### 1. Resource Not Found
```typescript
export class ResourceNotFoundError extends DomainError {
  constructor(public readonly resourceId: string) {
    super(resourceId);
  }
}

// Presentation
`❌ Resource not found: ${error.resourceId}`
```

### 2. Command Execution Failed
```typescript
export class CommandFailedError extends DomainError {
  constructor(public readonly stderr: string, public readonly exitCode?: number) {
    super(stderr);
  }
}

// Presentation
`❌ Command failed: ${error.stderr}`
```

### 3. Validation Failed
Use Zod for input validation, ErrorFormatter handles the formatting:
```typescript
// Throws ZodError automatically
const validated = schema.parse(input);

// ErrorFormatter formats it nicely
`❌ Validation failed: Invalid project path`
```

## Benefits

1. **Consistency**: Users see consistent error formatting across all tools
2. **Maintainability**: Error formatting logic is centralized
3. **Testability**: Domain logic doesn't depend on presentation
4. **Flexibility**: Easy to change formatting without touching business logic
5. **Type Safety**: TypeScript ensures error types are handled correctly