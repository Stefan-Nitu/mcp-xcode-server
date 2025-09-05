# Comprehensive Testing Philosophy

> "The more your tests resemble the way your software is used, the more confidence they can give you." - Kent C. Dodds

## Table of Contents
1. [Fundamental Principles](#fundamental-principles)
2. [Testing Strategies](#testing-strategies)
3. [Test Quality Principles](#test-quality-principles)
4. [Advanced Testing Patterns](#advanced-testing-patterns)
5. [Testing Anti-Patterns](#testing-anti-patterns)
6. [Architecture-Specific Testing](#architecture-specific-testing)
7. [Practical Guidelines](#practical-guidelines)
8. [Jest TypeScript Mocking Best Practices](#jest-typescript-mocking-best-practices)
9. [Troubleshooting Jest TypeScript Issues](#troubleshooting-jest-typescript-issues)
10. [Implementation Checklist](#implementation-checklist)

---

## Fundamental Principles


### 1. Parse, Don't Validate - Type Safety at Boundaries

**Principle**: Transform untrusted input into domain types at system boundaries. Once parsed, data is guaranteed valid throughout the system.

#### ✅ Good Example - Parse at Boundary
```typescript
// Parse raw input into domain type at the boundary
export const bootSimulatorSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required')
});

export type BootSimulatorArgs = z.infer<typeof bootSimulatorSchema>;

class BootSimulatorTool {
  async execute(args: any) {
    // Parse once at boundary
    const validated = bootSimulatorSchema.parse(args);
    // Now 'validated' is guaranteed to be valid BootSimulatorArgs
    // No need to check deviceId again anywhere in the system
    return this.bootDevice(validated);
  }
}
```

#### ❌ Bad Example - Validate Throughout
```typescript
class BootSimulatorTool {
  async execute(args: any) {
    // Checking validity everywhere = shotgun parsing
    if (!args.deviceId) throw new Error('No device ID');
    return this.bootDevice(args);
  }
  
  private async bootDevice(args: any) {
    // Having to check again!
    if (!args.deviceId || args.deviceId.length === 0) {
      throw new Error('Invalid device ID');
    }
    // ...
  }
}
```

### 2. Domain Primitives - Rich Types Over Primitives

**Principle**: Use domain-specific types that enforce invariants at creation time.

#### ✅ Good Example - Domain Primitive
```typescript
// DeviceId can only exist if valid
class DeviceId {
  private constructor(private readonly value: string) {}
  
  static parse(input: string): DeviceId {
    if (!input || input.length === 0) {
      throw new Error('Device ID cannot be empty');
    }
    if (!input.match(/^[A-F0-9-]+$/i)) {
      throw new Error('Invalid device ID format');
    }
    return new DeviceId(input);
  }
  
  toString(): string {
    return this.value;
  }
}

// Usage - type safety throughout
async bootDevice(deviceId: DeviceId) {
  // No need to validate - DeviceId guarantees validity
  await execAsync(`xcrun simctl boot "${deviceId}"`);
}
```

#### ❌ Bad Example - Primitive Obsession
```typescript
// Strings everywhere = no guarantees
async bootDevice(deviceId: string) {
  // Have to validate everywhere
  if (!deviceId) throw new Error('Invalid device');
  // Easy to pass wrong string
  await execAsync(`xcrun simctl boot "${deviceId}"`);
}

// Easy to mix up parameters
function buildProject(projectPath: string, scheme: string, configuration: string) {
  // Oops, swapped parameters - no compile-time error!
  return build(configuration, projectPath, scheme);
}
```

### 3. Test Behavior, Not Implementation

**Principle**: Test what your code does, not how it does it.

#### ✅ Good Example - Behavior Testing
```typescript
test('boots a simulator device', async () => {
  const tool = new BootSimulatorTool();
  const result = await tool.execute({ deviceId: 'iPhone 15' });
  
  // Test the behavior/outcome
  expect(result.content[0].text).toContain('booted');
  expect(result.content[0].text).toContain('iPhone 15');
});

test('handles already booted device gracefully', async () => {
  const tool = new BootSimulatorTool();
  
  // First boot
  await tool.execute({ deviceId: 'iPhone 15' });
  
  // Second boot should handle gracefully
  const result = await tool.execute({ deviceId: 'iPhone 15' });
  expect(result.content[0].text).toContain('already booted');
});
```

#### ❌ Bad Example - Implementation Testing
```typescript
test('calls correct commands in sequence', async () => {
  const tool = new BootSimulatorTool();
  await tool.execute({ deviceId: 'test-id' });
  
  // Testing HOW it works, not WHAT it does
  expect(mockExecAsync).toHaveBeenCalledWith('xcrun simctl list devices --json');
  expect(mockExecAsync).toHaveBeenCalledWith('xcrun simctl boot "test-id"');
  expect(mockExecAsync).toHaveBeenCalledTimes(2);
  expect(mockExecAsync.mock.calls[0]).toHaveBeenCalledBefore(mockExecAsync.mock.calls[1]);
});
```

## Testing Strategies

### The Testing Trophy (Not Pyramid) - Modern Approach

Based on Kent C. Dodds' philosophy: **"Write tests. Not too many. Mostly integration."**

```
       /\
      /e2e\      <- 10%: Critical user paths
     /------\
    /  integ \   <- 60%: Component interactions (THE FOCUS)
   /----------\
  /    unit    \ <- 25%: Complex logic, algorithms
 /--------------\
/     static     \ <- 5%: TypeScript, ESLint
```

**Why Trophy Over Pyramid**: 
- Integration tests provide the best confidence-to-effort ratio
- Modern tools make integration tests fast
- Unit tests often test implementation details
- "The more your tests resemble the way your software is used, the more confidence they can give you"

### When to Use Each Test Type

#### Static Testing (TypeScript, ESLint)
- **Use for**: Type safety, code style, obvious errors
- **Example**: TypeScript ensuring correct function signatures

#### Unit Tests - Solitary
- **Use for**: Pure functions, complex algorithms, data transformations
- **Mock**: All dependencies
- **Example**: Testing a sorting algorithm, parsing logic

#### Unit Tests - Sociable (Kent Beck's Original Approach)
- **Use for**: Testing small units with their real collaborators
- **Mock**: Only awkward dependencies (network, filesystem)
- **Example**: Testing a service with its real validator

#### ✅ Good Sociable Unit Test
```typescript
test('XcodeProject builds with real configuration', async () => {
  // Use real Configuration and ProjectParser
  const config = new Configuration({ scheme: 'MyApp' });
  const parser = new ProjectParser();
  const project = new XcodeProject('path/to/project', config, parser);
  
  // Only mock the subprocess boundary
  mockExecAsync.mockResolvedValue({ stdout: 'Build succeeded' });
  
  const result = await project.build();
  expect(result.success).toBe(true);
});
```

#### Integration Tests - Narrow (Recommended)
- **Use for**: Testing specific integration points
- **Mock**: External boundaries only (subprocess, network, filesystem)
- **Focus**: Data flow between components

#### ✅ Good Narrow Integration Test
```typescript
test('device information flows correctly through tool chain', async () => {
  // Mock only external boundary
  mockExecAsync.mockResolvedValue({
    stdout: JSON.stringify({ devices: deviceList })
  });
  
  // Test real component interaction
  const tool = new BootSimulatorTool(); // Uses real Devices, real SimulatorDevice
  const result = await tool.execute({ deviceId: 'iPhone 15' });
  
  // Verify outcome, not implementation
  expect(result.content[0].text).toContain('iPhone 15');
});
```

#### Integration Tests - Broad (Use Sparingly)
- **Use for**: Critical paths that must work
- **Mock**: Nothing - use real services
- **Also called**: E2E tests, system tests

#### End-to-End Tests
- **Use for**: Critical user journeys, smoke tests
- **Mock**: Nothing
- **Example**: Actually booting a real simulator

### Contract Testing - API Boundaries

**When to use**: When you have separate services/modules that communicate

#### Consumer-Driven Contract Example
```typescript
// Consumer defines what it needs
const consumerContract = {
  getDevice: {
    request: { deviceId: 'string' },
    response: { 
      id: 'string',
      name: 'string',
      state: 'Booted' | 'Shutdown'
    }
  }
};

// Provider verifies it can fulfill the contract
test('Devices service fulfills consumer contract', async () => {
  const device = await devices.find('test-id');
  expect(device).toMatchObject({
    id: expect.any(String),
    name: expect.any(String),
    state: expect.stringMatching(/Booted|Shutdown/)
  });
});
```

## Property-Based Testing

**Use for**: Finding edge cases, testing invariants

### Example: Testing Invariants
```typescript
import { property, forAll, string } from 'fast-check';

test('device ID parsing is reversible', () => {
  property(
    forAll(string(), (input) => {
      try {
        const deviceId = DeviceId.parse(input);
        const serialized = deviceId.toString();
        const reparsed = DeviceId.parse(serialized);
        // Invariant: parse → toString → parse = identity
        return reparsed.toString() === serialized;
      } catch {
        // Invalid inputs should consistently fail
        expect(() => DeviceId.parse(input)).toThrow();
        return true;
      }
    })
  );
});
```

## Anti-Patterns to Avoid

### 1. Testing Private Methods
```typescript
// ❌ BAD: Testing internals
test('private parseDeviceList works', () => {
  const devices = new Devices();
  // @ts-ignore - accessing private method
  const parsed = devices.parseDeviceList(json);
  expect(parsed).toHaveLength(3);
});

// ✅ GOOD: Test through public API
test('finds devices from list', async () => {
  const devices = new Devices();
  const device = await devices.find('iPhone 15');
  expect(device).toBeDefined();
});
```

### 2. Excessive Mocking
```typescript
// ❌ BAD: Mocking everything
test('device boots', async () => {
  const mockDevice = {
    bootDevice: jest.fn(),
    open: jest.fn(),
    id: 'test',
    name: 'Test Device'
  };
  const mockDevices = {
    find: jest.fn().mockResolvedValue(mockDevice)
  };
  const tool = new BootSimulatorTool(mockDevices);
  // This tests nothing real!
});

// ✅ GOOD: Minimal mocking
test('device boots', async () => {
  mockExecAsync.mockResolvedValue({ stdout: '' });
  const tool = new BootSimulatorTool(); // Real components
  await tool.execute({ deviceId: 'iPhone 15' });
  // Tests actual integration
});
```

### 3. Snapshot Testing Without Thought
```typescript
// ❌ BAD: Meaningless snapshot
test('renders correctly', () => {
  const result = tool.execute(args);
  expect(result).toMatchSnapshot();
  // What are we actually testing?
});

// ✅ GOOD: Specific assertions
test('returns success message with device name', async () => {
  const result = await tool.execute({ deviceId: 'iPhone 15' });
  expect(result.content[0].text).toContain('Successfully booted');
  expect(result.content[0].text).toContain('iPhone 15');
});
```

## Practical Guidelines for This Project

### 1. Test Categorization

**Keep as E2E (10%)**:
- Critical paths: build → run → test cycle
- Simulator boot/shutdown with real devices
- Actual Xcode project compilation

**Convert to Integration (60%)**:
- Tool composition tests (Tool → Service → Component)
- Data flow tests
- Error propagation tests

**Convert to Unit (30%)**:
- Validation logic
- Parsing functions
- Error message formatting
- Configuration merging

### 2. Where to Mock

**Always Mock**:
- `execAsync` / `execSync` - subprocess calls
- File system operations
- Network requests
- Time-dependent operations

**Never Mock**:
- Your own domain objects
- Simple data transformations
- Validation logic
- Pure functions

### 3. Test Naming Conventions

#### File Naming Pattern

**Standard**: `[ComponentName].[test-type].test.ts`

```bash
# Unit tests - test a single unit in isolation
XcbeautifyOutputParser.unit.test.ts
DeviceValidator.unit.test.ts
BuildCommandBuilder.unit.test.ts

# Integration tests - test components working together
BuildWorkflow.integration.test.ts
DeviceManagement.integration.test.ts

# E2E tests - test complete user scenarios
BuildAndRun.e2e.test.ts
SimulatorLifecycle.e2e.test.ts

# Contract tests - verify API contracts
DeviceService.contract.test.ts
```

**Why include test type in filename?**
- Immediately clear what type of test without opening file
- Can run specific test types: `jest *.unit.test.ts`
- Different test types have different performance characteristics
- Helps maintain proper test pyramid/trophy distribution

#### Directory Structure

```
src/__tests__/
├── unit/
│   ├── domain/           # Pure business logic
│   ├── application/      # Use cases and orchestration
│   ├── infrastructure/   # External adapters
│   └── utils/           # Helper functions
├── integration/         # Component interactions
├── e2e/                # Full system tests
└── contracts/          # API contract tests
```

#### Test Suite Organization

```typescript
// Mirror your source code structure in describe blocks
describe('XcbeautifyOutputParser', () => {  // Class/module name
  describe('parseBuildOutput', () => {      // Method name
    describe('when parsing errors', () => { // Scenario
      it('should extract file information from error line', () => {});
      it('should handle errors without file paths', () => {});
    });
    
    describe('when parsing warnings', () => {
      it('should extract warning details', () => {});
    });
  });
});
```

#### Individual Test Naming

**Pattern**: `should [expected behavior] when [condition]`

```typescript
// ✅ GOOD: Clear behavior and condition
it('should parse error with file information when line contains file path', () => {});
it('should return empty array when input is empty', () => {});
it('should throw ValidationError when device ID is invalid', () => {});
it('should deduplicate identical errors when parsing multi-arch output', () => {});

// ❌ BAD: Vague or implementation-focused
it('works', () => {});
it('parses correctly', () => {});
it('calls parseError method', () => {});
it('test case 1', () => {});
```

**Alternative patterns for specific scenarios**:

```typescript
// Given-When-Then (BDD style)
it('given a shutdown device, when boot is called, then device should be in booted state', () => {});

// Error scenarios - be specific about the error
it('should throw InvalidPathError when project path does not exist', () => {});
it('should throw TimeoutError when device does not respond within 5 seconds', () => {});

// Edge cases - explain what makes it an edge case
it('should handle empty array without throwing', () => {});
it('should process 10,000 items without memory overflow', () => {});
it('should correctly parse Unicode characters in file paths', () => {});

// Regression tests - reference the issue
it('should not crash when device name contains spaces (fixes #123)', () => {});
```

#### Mock and Test Data Naming

```typescript
// Use descriptive prefixes
const mockDeviceRepository = { find: jest.fn() };
const stubLogger = { log: () => {} };
const spyOnExecute = jest.spyOn(executor, 'execute');
const fakeDevice = { id: '123', name: 'Test Device' };

// Test data should describe the scenario
const validConfiguration = createConfiguration({ valid: true });
const invalidConfiguration = createConfiguration({ valid: false });
const minimalDevice = createDevice();  // defaults only
const bootedDevice = createBootedDevice();
const deviceWithError = createDeviceWithError('Boot failed');

// ❌ Avoid generic names
const data = {};      // What kind of data?
const obj = {};       // What object?
const mock1 = {};     // Mock of what?
const testDevice = {}; // All devices in tests are test devices
```

## Testing Decision Tree

```
Is it a pure function?
  Yes → Unit test with examples
  No ↓

Does it integrate with external systems?
  Yes → Mock external boundary, integration test
  No ↓

Is it orchestrating multiple components?
  Yes → Integration test with real components
  No ↓

Is it a critical user path?
  Yes → E2E test
  No ↓

Is the logic complex?
  Yes → Unit test with sociable approach
  No → Maybe doesn't need a test
```

## Measuring Test Quality

### Good Tests Are:
1. **Fast**: Run in milliseconds, not seconds
2. **Deterministic**: Same input → same output
3. **Isolated**: Can run in parallel
4. **Descriptive**: Clear what failed and why
5. **Maintainable**: Don't break on refactoring

### Red Flags:
- Tests that break when refactoring
- Tests with lots of mocks
- Tests that are hard to understand
- Tests that are slow
- Tests that are flaky

## Implementation Checklist

- [ ] Parse inputs at system boundaries using Zod
- [ ] Create domain primitives for core concepts (DeviceId, BundleId, etc.)
- [ ] Remove integration tests that test implementation
- [ ] Convert E2E tests to integration tests where possible
- [ ] Focus on behavior, not implementation
- [ ] Use Kent C. Dodds' Testing Trophy approach
- [ ] Mock only at system boundaries
- [ ] Add property-based tests for invariants
- [ ] Use contract tests for module boundaries

## Test Quality Principles

### SUT (System Under Test) Pattern

**Principle**: Clearly identify and isolate the system being tested. Use factory methods to create the SUT and test data, making tests more maintainable and resistant to implementation changes.

#### ✅ Good Example - SUT with Factory Methods
```typescript
describe('XcbeautifyOutputParser', () => {
  // Factory method for creating the SUT
  function createSUT(): IOutputParser {
    return new XcbeautifyOutputParser();
  }

  // Factory methods for test data
  function createErrorWithFileInfo(
    file = '/Users/project/App.swift',
    line = 10,
    column = 15,
    message = 'cannot find type'
  ) {
    return `❌ ${file}:${line}:${column}: error: ${message}`;
  }

  describe('parseBuildOutput', () => {
    let sut: IOutputParser;

    beforeEach(() => {
      sut = createSUT(); // Easy to modify creation logic
    });

    it('should parse errors with file information', () => {
      // Arrange - using factory methods
      const output = createErrorWithFileInfo(
        '/Users/project/Main.swift', 
        25, 
        8, 
        'missing return'
      );

      // Act - clear what's being tested
      const result = sut.parseBuildOutput(output);

      // Assert - focused on behavior
      expect(result.errors[0]).toMatchObject({
        file: '/Users/project/Main.swift',
        line: 25,
        column: 8
      });
    });
  });
});
```

#### ❌ Bad Example - Direct Instantiation
```typescript
describe('XcbeautifyOutputParser', () => {
  let parser: XcbeautifyOutputParser;

  beforeEach(() => {
    // Hard to change if constructor changes
    parser = new XcbeautifyOutputParser();
  });

  it('parses errors', () => {
    // Inline test data - hard to reuse
    const output = '❌ /Users/project/App.swift:10:15: error: cannot find type';
    
    // Not clear what's being tested
    const result = parser.parseBuildOutput(output);
    
    // Brittle assertions
    expect(result.errors[0].file).toBe('/Users/project/App.swift');
    expect(result.errors[0].line).toBe(10);
  });
});
```

#### Benefits of SUT Pattern

1. **Maintainability**: Change SUT creation in one place
2. **Clarity**: Clear distinction between SUT and collaborators
3. **Flexibility**: Easy to add constructor parameters
4. **Testability**: Can return mocks/stubs from factory when needed
5. **Documentation**: Factory method name describes what variant is created

#### Factory Method Best Practices

```typescript
// 1. Default values for common cases
function createTestDevice(overrides = {}) {
  return {
    id: 'default-id',
    name: 'iPhone 15',
    state: 'Shutdown',
    ...overrides  // Easy to customize
  };
}

// 2. Descriptive factory names for specific scenarios
function createBootedDevice() {
  return createTestDevice({ state: 'Booted' });
}

function createErrorDevice() {
  return createTestDevice({ state: 'Error', error: 'Boot failed' });
}

// 3. Factory for complex objects with builders
function createParsedOutputWithErrors(errorCount = 1) {
  const errors = Array.from({ length: errorCount }, (_, i) => ({
    type: 'error' as const,
    message: `Error ${i + 1}`,
    file: `/path/file${i}.swift`,
    line: i * 10,
    column: 5
  }));

  return {
    errors,
    warnings: [],
    summary: {
      totalErrors: errorCount,
      totalWarnings: 0,
      buildSucceeded: false
    }
  };
}
```

### FIRST Principles

Good tests follow the FIRST principles:

#### **F - Fast**
Tests should execute in milliseconds, not seconds. A test suite with 2000 tests at 200ms each takes 6.5 minutes - unacceptable for rapid feedback.

```typescript
// ✅ FAST: In-memory, no I/O
test('validates device ID format', () => {
  expect(() => DeviceId.parse('')).toThrow();
  expect(() => DeviceId.parse('valid-id')).not.toThrow();
}); // ~1ms

// ❌ SLOW: Network calls, file I/O
test('fetches device from API', async () => {
  const device = await fetch('https://api.example.com/devices/123');
  expect(device.name).toBe('iPhone');
}); // ~500ms
```

#### **I - Independent/Isolated**
Tests should not depend on each other or execution order.

```typescript
// ❌ BAD: Tests depend on shared state
let counter = 0;
test('first test', () => {
  counter++;
  expect(counter).toBe(1);
});
test('second test', () => {
  expect(counter).toBe(1); // Fails if run alone!
});

// ✅ GOOD: Each test is independent
test('first test', () => {
  const counter = createCounter();
  counter.increment();
  expect(counter.value).toBe(1);
});
```

#### **R - Repeatable**
Same input → same output, every time.

```typescript
// ❌ BAD: Time-dependent
test('checks if weekend', () => {
  const isWeekend = checkWeekend();
  expect(isWeekend).toBe(true); // Fails Monday-Friday!
});

// ✅ GOOD: Deterministic
test('checks if weekend', () => {
  const saturday = new Date('2024-01-06');
  const isWeekend = checkWeekend(saturday);
  expect(isWeekend).toBe(true);
});
```

#### **S - Self-Validating**
Tests must clearly pass or fail without human interpretation.

```typescript
// ❌ BAD: Requires manual verification
test('logs output correctly', () => {
  console.log(generateReport());
  // Developer must manually check console output
});

// ✅ GOOD: Automated assertion
test('generates correct report', () => {
  const report = generateReport();
  expect(report).toContain('Total: 100');
  expect(report).toMatch(/Date: \d{4}-\d{2}-\d{2}/);
});
```

#### **T - Timely**
Write tests alongside code, not after.

```typescript
// TDD Cycle: Red → Green → Refactor
// 1. Write failing test first
test('parses valid device ID', () => {
  const id = DeviceId.parse('ABC-123');
  expect(id.toString()).toBe('ABC-123');
});

// 2. Implement minimal code to pass
// 3. Refactor while tests stay green
```

### DRY vs DAMP in Tests

**DRY (Don't Repeat Yourself)**: Avoid duplication in production code.
**DAMP (Descriptive And Meaningful Phrases)**: Prioritize readability in test code.

#### When to Choose DAMP Over DRY

```typescript
// ❌ Too DRY - Hard to understand test failures
const testCases = [
  ['input1', 'output1'],
  ['input2', 'output2'],
  ['input3', 'output3']
];

testCases.forEach(([input, output]) => {
  test(`test ${input}`, () => {
    expect(process(input)).toBe(output);
  });
});

// ✅ DAMP - Clear and descriptive
test('handles empty string input', () => {
  const result = parseDeviceId('');
  expect(result).toBeNull();
  expect(console.error).toHaveBeenCalledWith('Device ID cannot be empty');
});

test('handles valid UUID format', () => {
  const result = parseDeviceId('550e8400-e29b-41d4-a716-446655440000');
  expect(result).toEqual({
    type: 'uuid',
    value: '550e8400-e29b-41d4-a716-446655440000'
  });
});

test('handles device name format', () => {
  const result = parseDeviceId('iPhone 15 Pro');
  expect(result).toEqual({
    type: 'name',
    value: 'iPhone 15 Pro'
  });
});
```

**Key Insight**: "DAMP not DRY" means tests should be easy to understand even if that means some code duplication. When a test fails, the reason should be immediately obvious.

#### When to Use beforeEach vs DAMP

**Use beforeEach for:**
- Technical housekeeping that doesn't affect test understanding (e.g., `jest.clearAllMocks()`)
- Mock resets and cleanup operations
- Setting up test infrastructure that's identical across all tests

```typescript
// ✅ GOOD - beforeEach for technical housekeeping
describe('ProjectPath', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Technical cleanup, not test logic
  });
  
  it('should validate path exists', () => {
    // Test-specific setup visible here
    mockExistsSync.mockReturnValue(true);
    const result = ProjectPath.create('/path/to/project.xcodeproj');
    expect(result).toBeDefined();
  });
});

// ❌ BAD - Adding mockClear in every test
describe('ProjectPath', () => {
  it('should validate path exists', () => {
    mockExistsSync.mockClear(); // Repetitive technical detail
    mockExistsSync.mockReturnValue(true);
    const result = ProjectPath.create('/path/to/project.xcodeproj');
    expect(result).toBeDefined();
  });
  
  it('should reject invalid path', () => {
    mockExistsSync.mockClear(); // Same line in every test!
    mockExistsSync.mockReturnValue(false);
    // ...
  });
});
```

**Apply DAMP (avoid beforeEach) for:**
- Test data setup that varies between tests
- SUT (System Under Test) creation
- Mock configurations specific to test scenarios
- Anything that helps understand what the test is doing

#### SUT Creation Pattern - DAMP Over DRY

For simple SUTs (System Under Test), create them directly in each test for maximum clarity:

```typescript
// ✅ GOOD - Create SUT in each test for clarity
describe('XcbeautifyOutputParser', () => {
  function createSUT(): IOutputParser {
    return new XcbeautifyOutputParser();
  }

  it('should parse error with file information', () => {
    // Everything the test needs is visible here
    const sut = createSUT();
    const output = '❌ /path/file.swift:10:5: error message';
    
    const result = sut.parseBuildOutput(output);
    
    expect(result.issues[0]).toEqual(
      BuildIssue.error('error message', '/path/file.swift', 10, 5)
    );
  });
});

// ❌ BAD - Hidden setup in beforeEach
describe('XcbeautifyOutputParser', () => {
  let sut: IOutputParser;
  
  beforeEach(() => {
    sut = createSUT(); // Setup hidden from test
  });
  
  it('should parse error with file information', () => {
    // Have to look at beforeEach to understand setup
    const output = '❌ /path/file.swift:10:5: error message';
    const result = sut.parseBuildOutput(output);
    // ...
  });
});
```

#### SUT with Dependencies Pattern

When the SUT needs mocked dependencies, return both from the factory:

```typescript
// ✅ GOOD - Factory returns SUT with its mocks
describe('XcodePlatformValidator', () => {
  function createSUT() {
    const mockExecute = jest.fn();
    const mockExecutor: ICommandExecutor = { execute: mockExecute };
    const sut = new XcodePlatformValidator(mockExecutor);
    return { sut, mockExecute };
  }

  it('should validate platform support', async () => {
    // Everything needed is created together
    const { sut, mockExecute } = createSUT();
    
    mockExecute.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
    
    await sut.validate('/path', false, 'MyScheme', Platform.iOS);
    
    expect(mockExecute).toHaveBeenCalled();
  });
});

// ❌ BAD - Separate mock creation leads to duplication
describe('XcodePlatformValidator', () => {
  it('should validate platform support', async () => {
    const mockExecute = jest.fn();
    const mockExecutor = { execute: mockExecute };
    const sut = new XcodePlatformValidator(mockExecutor);
    // ... rest of test
  });
  
  it('should handle errors', async () => {
    // Duplicating mock setup
    const mockExecute = jest.fn();
    const mockExecutor = { execute: mockExecute };
    const sut = new XcodePlatformValidator(mockExecutor);
    // ... rest of test
  });
});
```

**Why this approach?**
1. **Complete visibility** - All setup is visible in the test
2. **Self-contained tests** - Each test is independent and complete
3. **Easy debugging** - When a test fails, everything is right there
4. **Follows AAA pattern** - Arrange is explicit in each test

## Advanced Testing Patterns

### Mutation Testing - Test Your Tests

Mutation testing injects faults into your code to verify that your tests catch them. It literally "tests your tests".

#### How It Works
1. Make small changes (mutations) to your code
2. Run tests against mutated code  
3. Tests should fail ("kill the mutant")
4. If tests pass, you have inadequate coverage

#### Example Mutations
```typescript
// Original code
function isAdult(age: number): boolean {
  return age >= 18;
}

// Mutations:
// 1. Change >= to >
return age > 18;  // Tests should catch this

// 2. Change 18 to 17
return age >= 17; // Tests should catch this

// 3. Change >= to <=
return age <= 18; // Tests should catch this
```

#### When to Use
- Mission-critical code
- Security-sensitive functions
- Core business logic
- After major refactoring

### Approval Testing (Golden Master)

Capture existing behavior as a "golden master" and detect any changes.

#### When to Use Approval Tests

```typescript
// ✅ GOOD: Complex output that's hard to assert
test('generates PDF report', async () => {
  const pdf = await generateReport(data);
  expect(pdf).toMatchSnapshot();
  // or
  expect(pdf).toMatchApprovedFile('report.approved.pdf');
});

// ✅ GOOD: Legacy code characterization
test('existing calculator behavior', () => {
  const results = [];
  for (let i = 0; i < 100; i++) {
    results.push(legacyCalculator.compute(i));
  }
  expect(results).toMatchSnapshot();
});

// ❌ BAD: Simple values
test('adds two numbers', () => {
  expect(add(2, 2)).toMatchSnapshot(); // Just use toBe(4)!
});
```

#### Key Benefits
- Quick tests for legacy code
- Handles complex outputs (PDFs, images, reports)
- Makes reviewers see changes clearly
- Enables safe refactoring

### Fuzz Testing

Automatically generate random, invalid, or unexpected inputs to find edge cases and security vulnerabilities.

#### Example Implementation
```typescript
import fc from 'fast-check';

test('device ID parser handles any input safely', () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      // Should never throw unhandled exception
      try {
        const result = parseDeviceId(input);
        // If it returns a result, it should be valid
        if (result) {
          expect(result.id).toBeTruthy();
          expect(result.type).toMatch(/uuid|name/);
        }
        return true;
      } catch (e) {
        // Should only throw expected errors
        expect(e.message).toMatch(/Invalid device ID|Empty input/);
        return true;
      }
    })
  );
});
```

#### What Fuzzing Finds
- Buffer overflows
- SQL injection vulnerabilities
- XSS vulnerabilities  
- Race conditions
- Memory leaks
- Unexpected crashes

### Testing Async Code

#### Common Pitfalls and Solutions

```typescript
// ❌ BAD: Not waiting for promise
test('async operation', () => {
  doAsyncThing(); // Test passes before this completes!
  expect(result).toBe(true);
});

// ❌ BAD: Mixing callbacks and promises
test('async operation', (done) => {
  doAsyncThing().then(result => {
    expect(result).toBe(true);
    done(); // Easy to forget!
  });
});

// ✅ GOOD: async/await
test('async operation', async () => {
  const result = await doAsyncThing();
  expect(result).toBe(true);
});

// ✅ GOOD: Testing race conditions
test('handles concurrent requests', async () => {
  const promises = [
    fetchUser('alice'),
    fetchUser('bob'),
    fetchUser('charlie')
  ];
  
  const results = await Promise.all(promises);
  expect(results).toHaveLength(3);
  expect(new Set(results.map(r => r.id)).size).toBe(3); // All unique
});

// ✅ GOOD: Testing timeouts
test('times out after 5 seconds', async () => {
  jest.useFakeTimers();
  
  const promise = fetchWithTimeout(url, 5000);
  jest.advanceTimersByTime(5001);
  
  await expect(promise).rejects.toThrow('Timeout');
  jest.useRealTimers();
});
```

## Testing Anti-Patterns

### Common Test Smells

#### 1. Mystery Guest
```typescript
// ❌ BAD: External dependency hidden
test('processes user data', async () => {
  const result = await processUser('user-123'); // What's user-123?
  expect(result.name).toBe('Alice'); // Why Alice?
});

// ✅ GOOD: Self-contained test
test('processes user data', async () => {
  const testUser = {
    id: 'user-123',
    name: 'Alice',
    email: 'alice@example.com'
  };
  await createTestUser(testUser);
  
  const result = await processUser(testUser.id);
  expect(result.name).toBe(testUser.name);
});
```

#### 2. Eager Test
```typescript
// ❌ BAD: Testing too much in one test
test('user workflow', async () => {
  const user = await createUser(data);
  expect(user.id).toBeDefined();
  
  const updated = await updateUser(user.id, newData);
  expect(updated.name).toBe(newData.name);
  
  const deleted = await deleteUser(user.id);
  expect(deleted).toBe(true);
  
  const fetched = await getUser(user.id);
  expect(fetched).toBeNull();
});

// ✅ GOOD: Focused tests
test('creates user with valid data', async () => {
  const user = await createUser(validData);
  expect(user.id).toBeDefined();
  expect(user.name).toBe(validData.name);
});

test('updates existing user', async () => {
  const user = await createTestUser();
  const updated = await updateUser(user.id, { name: 'New Name' });
  expect(updated.name).toBe('New Name');
});
```

#### 3. Excessive Setup (General Fixture)
```typescript
// ❌ BAD: Setting up everything for every test
beforeEach(() => {
  createDatabase();
  seedUsers(100);
  seedProducts(500);
  seedOrders(1000);
  setupMockServers();
  initializeCache();
});

test('gets user by id', async () => {
  // Only needs one user!
  const user = await getUser('user-1');
  expect(user.name).toBe('User 1');
});

// ✅ GOOD: Minimal setup
test('gets user by id', async () => {
  const user = await createTestUser({ name: 'Test User' });
  const fetched = await getUser(user.id);
  expect(fetched.name).toBe('Test User');
});
```

#### 4. Assertion Roulette
```typescript
// ❌ BAD: Multiple assertions without context
test('processes order', () => {
  const order = processOrder(data);
  expect(order.id).toBeDefined();
  expect(order.total).toBe(100);
  expect(order.items).toHaveLength(3);
  expect(order.status).toBe('pending');
  expect(order.customer).toBeDefined();
});

// ✅ GOOD: Descriptive assertions
test('processes order', () => {
  const order = processOrder(data);
  
  expect(order.id).toBeDefined();
  expect(order.total).toBe(100);
  expect(order.items).toHaveLength(3);
  expect(order.status).toBe('pending');
  expect(order.customer).toBeDefined();
});
```

#### 5. Test Code Duplication
```typescript
// ❌ BAD: Copying setup code
test('test 1', () => {
  const device = {
    id: 'test-id',
    name: 'iPhone',
    state: 'Booted'
  };
  // ... test logic
});

test('test 2', () => {
  const device = {
    id: 'test-id',
    name: 'iPhone',
    state: 'Booted'
  };
  // ... test logic
});

// ✅ GOOD: Extract factory function
function createTestDevice(overrides = {}) {
  return {
    id: 'test-id',
    name: 'iPhone',
    state: 'Booted',
    ...overrides
  };
}

test('test 1', () => {
  const device = createTestDevice();
  // ... test logic
});

test('test 2', () => {
  const device = createTestDevice({ state: 'Shutdown' });
  // ... test logic
});
```

## Architecture-Specific Testing

### Hexagonal Architecture (Ports & Adapters)

#### Test Boundaries
```typescript
// Domain (Hexagon Core)
class DeviceService {
  constructor(
    private deviceRepo: DeviceRepository, // Port
    private notifier: NotificationService // Port
  ) {}
  
  async bootDevice(id: string): Promise<void> {
    const device = await this.deviceRepo.find(id);
    if (!device) throw new Error('Device not found');
    
    await device.boot();
    await this.deviceRepo.save(device);
    await this.notifier.notify(`Device ${id} booted`);
  }
}

// Test at port boundary - mock adapters
test('boots device through service', async () => {
  const mockRepo = {
    find: jest.fn().mockResolvedValue(testDevice),
    save: jest.fn().mockResolvedValue(void 0)
  };
  const mockNotifier = {
    notify: jest.fn().mockResolvedValue(void 0)
  };
  
  const service = new DeviceService(mockRepo, mockNotifier);
  await service.bootDevice('test-id');
  
  expect(mockRepo.save).toHaveBeenCalledWith(
    expect.objectContaining({ state: 'Booted' })
  );
  expect(mockNotifier.notify).toHaveBeenCalled();
});

// Contract test for adapter
test('repository adapter fulfills contract', async () => {
  const repo = new MongoDeviceRepository();
  const device = await repo.find('test-id');
  
  // Verify contract shape
  expect(device).toMatchObject({
    id: expect.any(String),
    name: expect.any(String),
    boot: expect.any(Function)
  });
});
```

#### Key Benefits
- Test core logic without infrastructure
- Fast unit tests for business rules
- Contract tests ensure adapters comply
- Easy to swap implementations

### Microservices Testing

#### Testing Strategy Pyramid
```
         /\
        /e2e\       <- Cross-service journeys
       /------\
      /contract\    <- Service boundaries (Pact)
     /----------\
    /integration \  <- Within service
   /--------------\
  /     unit       \ <- Business logic
 /------------------\
```

#### Consumer-Driven Contract Testing
```typescript
// Consumer defines expectations
const deviceServiceContract = {
  'get device': {
    request: {
      method: 'GET',
      path: '/devices/123'
    },
    response: {
      status: 200,
      body: {
        id: '123',
        name: 'iPhone 15',
        state: 'Booted'
      }
    }
  }
};

// Provider verifies it can fulfill
test('device service fulfills contract', async () => {
  const response = await request(app)
    .get('/devices/123')
    .expect(200);
    
  expect(response.body).toMatchObject({
    id: expect.any(String),
    name: expect.any(String),
    state: expect.stringMatching(/Booted|Shutdown/)
  });
});
```

## Practical Guidelines

### Test Organization

#### AAA Pattern (Arrange-Act-Assert)
```typescript
test('should boot simulator when device exists', async () => {
  // Arrange
  const mockDevice = createMockDevice({ state: 'Shutdown' });
  const tool = new BootSimulatorTool();
  mockDevices.find.mockResolvedValue(mockDevice);
  
  // Act
  const result = await tool.execute({ deviceId: 'iPhone-15' });
  
  // Assert
  expect(result.success).toBe(true);
  expect(result.message).toContain('booted');
});
```

#### Given-When-Then (BDD Style)
```typescript
test('boots simulator successfully', async () => {
  // Given a shutdown simulator exists
  const device = givenAShutdownSimulator();
  
  // When I boot the simulator
  const result = await whenIBootSimulator(device.id);
  
  // Then the simulator should be booted
  thenSimulatorShouldBeBooted(result);
});
```

### Test Data Management

#### Builder Pattern
```typescript
class DeviceBuilder {
  private device = {
    id: 'default-id',
    name: 'iPhone 15',
    state: 'Shutdown',
    platform: 'iOS'
  };
  
  withId(id: string): this {
    this.device.id = id;
    return this;
  }
  
  withState(state: string): this {
    this.device.state = state;
    return this;
  }
  
  booted(): this {
    this.device.state = 'Booted';
    return this;
  }
  
  build(): Device {
    return { ...this.device };
  }
}

// Usage
const device = new DeviceBuilder()
  .withId('test-123')
  .booted()
  .build();
```

#### Object Mother Pattern
```typescript
class DeviceMother {
  static bootedIPhone(): Device {
    return {
      id: 'iphone-test',
      name: 'iPhone 15 Pro',
      state: 'Booted',
      platform: 'iOS'
    };
  }
  
  static shutdownAndroid(): Device {
    return {
      id: 'android-test',
      name: 'Pixel 8',
      state: 'Shutdown',
      platform: 'Android'
    };
  }
}

// Usage
const device = DeviceMother.bootedIPhone();
```

## Jest TypeScript Mocking Best Practices

### 1. Always Provide Explicit Type Signatures to jest.fn()

**Principle**: TypeScript requires explicit function signatures for proper type inference with mocks.

#### ❌ Bad - Causes "type never" errors
```typescript
const mockFunction = jest.fn();
mockFunction.mockResolvedValue({ success: true }); // Error: type 'never'
```

#### ✅ Good - Modern Jest syntax (Jest 27+)
```typescript
// Single type parameter with full function signature
const mockFunction = jest.fn<() => Promise<{ success: boolean }>>();
mockFunction.mockResolvedValue({ success: true }); // Works!

// With parameters
const mockBuildProject = jest.fn<(options: BuildOptions) => Promise<BuildResult>>();

// Multiple parameters
const mockCallback = jest.fn<(error: Error | null, data?: string) => void>();
```

**Note**: Jest 27+ uses a single type parameter for the entire function signature, not separate return and argument types.

### 2. Handle instanceof Checks with Object.create()

**Principle**: When code uses `instanceof` checks, create mocks that pass these checks.

#### ❌ Bad - Plain object fails instanceof
```typescript
const mockXcodeProject = {
  buildProject: jest.fn()
};
// Fails: if (!(project instanceof XcodeProject))
```

#### ✅ Good - Use Object.create with prototype
```typescript
const mockBuildProject = jest.fn<(options: any) => Promise<any>>();
const mockXcodeProject = Object.create(XcodeProject.prototype);
mockXcodeProject.buildProject = mockBuildProject;
// Passes: if (project instanceof XcodeProject) ✓
```

### 3. Match Async vs Sync Return Types

**Principle**: Use the correct mock method based on function return type.

#### ❌ Bad - Mixing async/sync
```typescript
const mockSync = jest.fn<() => string>();
mockSync.mockResolvedValue('result'); // Wrong! Use mockReturnValue

const mockAsync = jest.fn<() => Promise<string>>();
mockAsync.mockReturnValue('result'); // Wrong! Use mockResolvedValue
```

#### ✅ Good - Match the return type
```typescript
// Synchronous
const mockSync = jest.fn<() => string>();
mockSync.mockReturnValue('result');

// Asynchronous
const mockAsync = jest.fn<() => Promise<string>>();
mockAsync.mockResolvedValue('result');
```

### 4. Mock Module Imports Correctly

**Principle**: Mock at module level and type the mocks properly.

```typescript
// Mock the module
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

### 5. Never Use Type Casting - Fix the Root Cause

**Principle**: Type casting hides problems. Fix the types properly instead.

#### ❌ Bad - Type casting
```typescript
const mockFunction = jest.fn() as any;
const mockFunction = jest.fn() as jest.Mock;
```

#### ✅ Good - Proper typing
```typescript
type BuildFunction = (path: string) => Promise<BuildResult>;
const mockBuild = jest.fn<BuildFunction>();
```

### 6. Sequential Mock Returns

```typescript
const mockExecAsync = jest.fn<(cmd: string) => Promise<{ stdout: string }>>();
mockExecAsync
  .mockResolvedValueOnce({ stdout: 'First call' })
  .mockResolvedValueOnce({ stdout: 'Second call' })
  .mockRejectedValueOnce(new Error('Third call fails'));
```

### Handling Flaky Tests

#### Identifying Flaky Tests
1. Run tests multiple times
2. Track failure patterns
3. Look for timing dependencies
4. Check for shared state

#### Common Causes and Fixes
```typescript
// ❌ FLAKY: Race condition
test('concurrent operations', async () => {
  startOperation1();
  startOperation2();
  await wait(100); // Arbitrary wait
  expect(getResult()).toBe('complete');
});

// ✅ FIXED: Proper synchronization
test('concurrent operations', async () => {
  const op1 = startOperation1();
  const op2 = startOperation2();
  await Promise.all([op1, op2]);
  expect(getResult()).toBe('complete');
});

// ❌ FLAKY: External dependency
test('fetches weather', async () => {
  const weather = await fetchWeather('London');
  expect(weather.temp).toBeGreaterThan(0);
});

// ✅ FIXED: Mock external service
test('fetches weather', async () => {
  mockWeatherAPI.mockResolvedValue({ temp: 20, condition: 'sunny' });
  const weather = await fetchWeather('London');
  expect(weather.temp).toBe(20);
});
```

## Troubleshooting Jest TypeScript Issues

### Common Problems and Solutions

#### Problem: "Argument of type X is not assignable to parameter of type 'never'"
**Solution**: Add explicit type signature to jest.fn()
```typescript
// Wrong
const mock = jest.fn();
// Right
const mock = jest.fn<() => Promise<string>>();
```

#### Problem: "Expected 0-1 type arguments, but got 2" (TS2558)
**Solution**: You're using old Jest syntax. Use modern syntax:
```typescript
// Wrong (old syntax)
jest.fn<any, any[]>()
// Right (modern syntax)
jest.fn<(...args: any[]) => any>()
```

#### Problem: instanceof checks failing in tests
**Solution**: Use Object.create(ClassName.prototype) for the mock object

#### Problem: Mock structure doesn't match actual implementation
**Solution**: Always verify the actual interface by reading the source code

#### Problem: Validation errors not caught in tests
**Solution**: Use `await expect(...).rejects.toThrow()` for code that throws

## References

### Core Testing Philosophy
1. "Parse, Don't Validate" - Alexis King
2. "Domain Primitives" - Secure by Design (Dan Bergh Johnsson, Daniel Deogun, Daniel Sawano)
3. "Write tests. Not too many. Mostly integration." - Kent C. Dodds
4. "Test Behavior, Not Implementation" - Martin Fowler
5. "Working Effectively with Legacy Code" - Michael Feathers

### Testing Techniques
6. "Property-Based Testing" - QuickCheck (Koen Claessen and John Hughes)
7. "Consumer-Driven Contracts" - Pact
8. "The Art of Unit Testing" - Roy Osherove
9. "Growing Object-Oriented Software, Guided by Tests" - Steve Freeman and Nat Pryce
10. "xUnit Test Patterns" - Gerard Meszaros

### Modern Approaches
11. "Testing Trophy" - Kent C. Dodds
12. "Mutation Testing" - PITest, Stryker
13. "Approval Tests" - Llewellyn Falco
14. "Hexagonal Architecture" - Alistair Cockburn
15. "FIRST Principles" - Clean Code (Robert C. Martin)