# Jest TypeScript Mocking Best Practices

## Overview
This document outlines best practices for mocking in Jest with TypeScript, based on lessons learned from fixing type errors in the mcp-xcode-server project.

## Key Principles

### 1. Always Provide Explicit Type Signatures to jest.fn()

**❌ Bad Practice - Causes "type never" errors:**
```typescript
const mockFunction = jest.fn();
mockFunction.mockResolvedValue({ success: true }); // Error: Argument not assignable to type 'never'
```

**❌ Old Syntax (pre-Jest 27) - Now causes TypeScript errors:**
```typescript
// This syntax is deprecated and will cause TS2558 errors
const mockFunction = jest.fn<ReturnType, ArgsType[]>();
const mockBuild = jest.fn<any, any[]>(); // Error: Expected 0-1 type arguments, but got 2
```

**✅ Good Practice - Modern Jest syntax (Jest 27+):**
```typescript
// Correct: Use a single type parameter with the full function signature
const mockFunction = jest.fn<() => Promise<{ success: boolean }>>();
mockFunction.mockResolvedValue({ success: true }); // Works!

// With parameters - include them in the function signature:
const mockBuildProject = jest.fn<(options: BuildOptions) => Promise<BuildResult>>();

// For functions with multiple parameters:
const mockCallback = jest.fn<(error: Error | null, data?: string) => void>();
```

**Important Note:** Jest's TypeScript definitions changed in version 27. The generic `jest.fn()` now takes a single type parameter representing the entire function signature, not separate return and argument types.

### 2. Never Use Type Casting - Fix the Root Cause

**❌ Bad Practice - Type casting hides problems:**
```typescript
const mockFunction = jest.fn() as jest.Mock;
const mockFunction = jest.fn() as any;
(mockFunction as jest.MockedFunction<typeof originalFunction>).mockResolvedValue(...);
```

**✅ Good Practice - Proper typing from the start:**
```typescript
// Define the function signature explicitly
type BuildFunction = (path: string, options?: BuildOptions) => Promise<BuildResult>;
const mockBuild = jest.fn<BuildFunction>();

// Or inline:
const mockBuild = jest.fn<(path: string, options?: BuildOptions) => Promise<BuildResult>>();
```

### 3. Handle instanceof Checks with Object.create()

When your code uses `instanceof` checks, create mocks that pass these checks:

**❌ Bad Practice - Plain object fails instanceof:**
```typescript
const mockXcodeProject = {
  buildProject: jest.fn(),
  test: jest.fn()
};
// This will fail: if (!(project instanceof XcodeProject))
```

**✅ Good Practice - Use Object.create with prototype:**
```typescript
const mockBuildProject = jest.fn<(options: any) => Promise<any>>();
const mockXcodeProject = Object.create(XcodeProject.prototype);
mockXcodeProject.buildProject = mockBuildProject;
// Now passes: if (project instanceof XcodeProject) ✓
```

### 4. Match Async vs Sync Return Types

**❌ Bad Practice - Mixing async/sync:**
```typescript
const mockSync = jest.fn();
mockSync.mockResolvedValue('result'); // Wrong! mockResolvedValue is for async functions

const mockAsync = jest.fn<() => Promise<string>>();
mockAsync.mockReturnValue('result'); // Wrong! Should use mockResolvedValue
```

**✅ Good Practice - Match the return type:**
```typescript
// Synchronous function
const mockSync = jest.fn<() => string>();
mockSync.mockReturnValue('result');

// Asynchronous function
const mockAsync = jest.fn<() => Promise<string>>();
mockAsync.mockResolvedValue('result');
```

### 5. Use Dependency Injection for Testability

Design your classes to accept dependencies through constructor injection:

**✅ Good Practice - Testable design:**
```typescript
export class BuildXcodeTool {
  private devices: Devices;
  private xcode: Xcode;

  constructor(
    devices?: Devices,  // Optional for production, required for testing
    xcode?: Xcode
  ) {
    this.devices = devices || new Devices();
    this.xcode = xcode || new Xcode();
  }
}

// In tests:
const mockDevices = { find: jest.fn<(id: string) => Promise<Device>>() };
const tool = new BuildXcodeTool(mockDevices as any, mockXcode);
```

### 6. Type Mock Objects Properly

**✅ Good Practice - Create properly typed mock objects:**
```typescript
// Define mock with explicit types
const mockDevices = {
  find: jest.fn<(deviceId: string) => Promise<Device | null>>(),
  findForPlatform: jest.fn<(platform: Platform) => Promise<Device | null>>(),
  list: jest.fn<() => Promise<Device[]>>()
};

// Setup return values
mockDevices.find.mockResolvedValue({
  id: 'test-device-id',
  name: 'iPhone 15',
  state: 'Booted',
  ensureBooted: jest.fn<() => Promise<void>>()
} as Device);
```

### 7. Mock Module Imports Correctly

**✅ Good Practice - Mock at module level:**
```typescript
// Mock the entire module
jest.mock('fs', () => ({
  existsSync: jest.fn()
}));

// Import and type the mock
import { existsSync } from 'fs';
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

// Use in tests
beforeEach(() => {
  mockExistsSync.mockReturnValue(true);
});
```

## Common Patterns

### Pattern 1: Mocking a Class Method
```typescript
const mockBuildProject = jest.fn<(options: BuildOptions) => Promise<BuildResult>>();
mockBuildProject.mockResolvedValue({
  success: true,
  output: 'Build succeeded',
  appPath: '/path/to/app.app'
});
```

### Pattern 2: Mocking Error Scenarios
```typescript
const mockFunction = jest.fn<() => Promise<void>>();
mockFunction.mockRejectedValue(new Error('Build failed'));

// Or with additional error properties
const error = new Error('Build failed') as any;
error.stderr = 'xcodebuild: error: Scheme not found';
mockFunction.mockRejectedValue(error);
```

### Pattern 3: Sequential Mock Returns
```typescript
const mockExecAsync = jest.fn<(cmd: string) => Promise<{ stdout: string; stderr: string }>>();
mockExecAsync
  .mockResolvedValueOnce({ stdout: 'First call', stderr: '' })
  .mockResolvedValueOnce({ stdout: 'Second call', stderr: '' })
  .mockRejectedValueOnce(new Error('Third call fails'));
```

## Testing Philosophy

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it
2. **Avoid Over-Mocking**: Only mock external dependencies, not internal logic
3. **Keep Tests Simple**: Each test should verify one specific behavior
4. **Use Descriptive Test Names**: Clearly state what is being tested and expected outcome

## Example: Complete Test Setup

```typescript
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { BuildXcodeTool } from '../../tools/BuildXcodeTool.js';
import { XcodeProject } from '../../utils/projects/XcodeProject.js';

// Mock external modules
jest.mock('fs');
jest.mock('../../utils.js');

describe('BuildXcodeTool', () => {
  let tool: BuildXcodeTool;
  
  // Create typed mocks
  const mockBuildProject = jest.fn<(options: any) => Promise<any>>();
  const mockXcodeProject = Object.create(XcodeProject.prototype);
  mockXcodeProject.buildProject = mockBuildProject;
  
  const mockXcode = {
    open: jest.fn<(path: string) => Promise<any>>()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    tool = new BuildXcodeTool(undefined, mockXcode as any);
    mockXcode.open.mockResolvedValue(mockXcodeProject);
  });
  
  test('should build project successfully', async () => {
    mockBuildProject.mockResolvedValue({
      success: true,
      output: 'Build succeeded',
      appPath: '/path/to/app.app'
    });
    
    const result = await tool.execute({
      projectPath: '/test/project.xcodeproj',
      scheme: 'MyScheme'
    });
    
    expect(mockBuildProject).toHaveBeenCalledWith(
      expect.objectContaining({
        scheme: 'MyScheme'
      })
    );
    expect(result.content[0].text).toContain('Build succeeded');
  });
});
```

## Real-World Case Study: RunXcodeTool

### The Problem
When fixing RunXcodeTool unit tests, we encountered several issues:

1. **Type errors with jest.fn()**: Mock functions without explicit types caused "type never" errors
2. **instanceof checks failing**: The Xcode.open() method returns XcodeProject instances, and the code checks `instanceof XcodeProject`
3. **Incorrect mock structure**: The mock device object structure didn't match the actual SimulatorDevice interface
4. **Validation errors not caught**: Zod validation throws errors instead of returning error objects

### The Solution

**1. Fixed mock typing with explicit signatures:**
```typescript
// Before - causes type errors
const mockDevice = {
  ensureBooted: jest.fn(), // No type info
  install: jest.fn()
};

// After - properly typed
const mockDevice = {
  ensureBooted: jest.fn<() => Promise<void>>(),
  install: jest.fn<(appPath: string) => Promise<void>>(),
  launch: jest.fn<(bundleId: string) => Promise<string>>(),
  getBundleId: jest.fn<(appPath: string) => Promise<string>>()
};
```

**2. Fixed instanceof checks:**
```typescript
// The mock that passes instanceof check
const mockBuildProject = jest.fn<(args: any) => Promise<any>>();
const mockXcodeProject = Object.create(XcodeProject.prototype);
mockXcodeProject.buildProject = mockBuildProject;

const mockXcode = {
  open: jest.fn<(path: string) => Promise<any>>()
};
mockXcode.open.mockResolvedValue(mockXcodeProject);
```

**3. Matched actual interface structure:**
```typescript
// Wrong - device.ui.open() doesn't exist
const mockDevice = {
  ui: {
    open: jest.fn(),
    setAppearance: jest.fn()
  }
};

// Correct - methods are directly on device
const mockDevice = {
  open: jest.fn<() => Promise<void>>(),
  setAppearance: jest.fn<(appearance: string) => Promise<void>>()
};
```

**4. Handled validation errors properly:**
```typescript
// Wrong - expects error result
const result = await tool.execute({ platform: 'Invalid' });
expect(result.content[0].text).toContain('error');

// Correct - validation throws
await expect(tool.execute({ 
  platform: 'Invalid' 
})).rejects.toThrow('Invalid enum value');
```

## Troubleshooting

### Problem: "Argument of type X is not assignable to parameter of type 'never'"
**Solution**: Add explicit type signature to jest.fn()

### Problem: "Expected 0-1 type arguments, but got 2" (TS2558)
**Solution**: You're using old Jest syntax. Use `jest.fn<FunctionSignature>()` not `jest.fn<ReturnType, Args>()`. 
```typescript
// Wrong (old syntax):
jest.fn<any, any[]>()

// Correct (modern syntax):
jest.fn<(...args: any[]) => any>()
```

### Problem: "Cannot read property 'mockResolvedValue' of undefined"
**Solution**: Ensure the mock is created before trying to set return values

### Problem: instanceof checks failing in tests
**Solution**: Use Object.create(ClassName.prototype) for the mock object

### Problem: Mock not being called with expected arguments
**Solution**: Check that the mock is properly injected and that the test setup matches the actual code flow

### Problem: Mock structure doesn't match actual implementation
**Solution**: Always verify the actual interface by reading the source code, don't assume method locations

### Problem: Validation errors not caught in tests
**Solution**: Use `await expect(...).rejects.toThrow()` for code that throws instead of returning error objects

## References

- [Jest Mock Functions Documentation](https://jestjs.io/docs/mock-functions)
- [TypeScript Jest Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Jest TypeScript Configuration](https://jestjs.io/docs/getting-started#using-typescript)