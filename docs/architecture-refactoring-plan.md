# Architecture Refactoring Plan for Better Testability

## Current Architecture Problems

### 1. Tight Coupling
**Problem**: Tools directly instantiate their dependencies
```typescript
// Current - BuildXcodeTool.ts
export class BuildXcodeTool {
  constructor(devices?: Devices, xcode?: Xcode) {
    this.devices = devices || new Devices();  // Direct instantiation
    this.xcode = xcode || new Xcode();
  }
}
```

**Issue**: Hard to test because real objects are created, leading to deep call chains:
- BuildXcodeTool → Xcode → XcodeProject → XcodeBuild → execAsync

### 2. No Clear Boundaries
**Problem**: Business logic mixed with infrastructure
```typescript
// XcodeBuild.ts mixes:
- Business logic (build orchestration)
- Infrastructure (execAsync calls)
- File system operations
- Log management
```

### 3. Validation Throws Instead of Returns
**Problem**: Zod validation throws errors, making error handling inconsistent
```typescript
const validated = buildXcodeSchema.parse(args);  // Throws on error
```

## Proposed Architecture: Hexagonal/Ports & Adapters

### Core Principles
1. **Separate Core Domain from Infrastructure**
2. **Dependency Inversion** - Core depends on abstractions, not implementations
3. **Clear Boundaries** - Ports define contracts, Adapters implement them
4. **Testability First** - Every layer independently testable

### Proposed Structure

```
src/
├── domain/                  # Core business logic (no external deps)
│   ├── models/
│   │   ├── BuildRequest.ts
│   │   ├── BuildResult.ts
│   │   └── Device.ts
│   ├── services/
│   │   └── BuildService.ts  # Pure business logic
│   └── ports/               # Interfaces/contracts
│       ├── ICommandExecutor.ts
│       ├── IFileSystem.ts
│       ├── IDeviceManager.ts
│       └── IProjectLoader.ts
│
├── infrastructure/          # External world implementations
│   ├── adapters/
│   │   ├── ShellCommandExecutor.ts  # Implements ICommandExecutor
│   │   ├── NodeFileSystem.ts        # Implements IFileSystem
│   │   ├── XcodeDeviceManager.ts    # Implements IDeviceManager
│   │   └── XcodeProjectLoader.ts    # Implements IProjectLoader
│   └── tools/              # MCP tool wrappers
│       └── BuildXcodeTool.ts        # Thin wrapper, delegates to domain
│
└── __tests__/
    ├── unit/               # Test domain logic with test doubles
    ├── integration/        # Test adapters with real implementations
    └── e2e/               # Test critical paths end-to-end
```

## Refactoring Example: BuildXcodeTool

### Current (Tightly Coupled)
```typescript
export class BuildXcodeTool {
  private devices: Devices;
  private xcode: Xcode;
  
  constructor(devices?: Devices, xcode?: Xcode) {
    this.devices = devices || new Devices();
    this.xcode = xcode || new Xcode();
  }
  
  async execute(args: any) {
    const validated = buildXcodeSchema.parse(args);
    const project = await this.xcode.open(projectPath);
    const result = await project.buildProject(options);
    // ... lots of mixed logic
  }
}
```

### Proposed (Hexagonal Architecture)

#### 1. Define Port (Interface)
```typescript
// domain/ports/ICommandExecutor.ts
export interface ICommandExecutor {
  execute(command: string, options?: CommandOptions): Promise<CommandResult>;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// domain/ports/IProjectBuilder.ts
export interface IProjectBuilder {
  build(request: BuildRequest): Promise<BuildResult>;
  validateProject(path: string): Promise<ValidationResult>;
}
```

#### 2. Domain Service (Pure Business Logic)
```typescript
// domain/services/BuildService.ts
export class BuildService {
  constructor(
    private readonly commandExecutor: ICommandExecutor,
    private readonly projectValidator: IProjectValidator,
    private readonly deviceManager: IDeviceManager
  ) {}
  
  async build(request: BuildRequest): Promise<BuildResult> {
    // Pure business logic - easy to test
    const validation = await this.projectValidator.validate(request.projectPath);
    if (!validation.isValid) {
      return BuildResult.failure(validation.errors);
    }
    
    if (request.requiresDevice) {
      const device = await this.deviceManager.ensureDeviceReady(request.deviceId);
      request = request.withDevice(device);
    }
    
    const command = this.createBuildCommand(request);
    const result = await this.commandExecutor.execute(command);
    
    return this.parseBuildResult(result);
  }
  
  private createBuildCommand(request: BuildRequest): string {
    // Pure function - easy to test
    return `xcodebuild ${request.toCommandString()}`;
  }
}
```

#### 3. Infrastructure Adapter
```typescript
// infrastructure/adapters/ShellCommandExecutor.ts
export class ShellCommandExecutor implements ICommandExecutor {
  async execute(command: string, options?: CommandOptions): Promise<CommandResult> {
    // Only infrastructure concern
    const { stdout, stderr } = await execAsync(command, options);
    return { stdout, stderr, exitCode: 0 };
  }
}
```

#### 4. Tool (Thin Orchestration Layer)
```typescript
// infrastructure/tools/BuildXcodeTool.ts
export class BuildXcodeTool {
  private buildService: BuildService;
  
  constructor(buildService?: BuildService) {
    this.buildService = buildService || createDefaultBuildService();
  }
  
  async execute(args: any): Promise<ToolResult> {
    // Validation with error handling
    const validation = BuildRequest.validate(args);
    if (!validation.success) {
      return ToolResult.validationError(validation.errors);
    }
    
    try {
      const result = await this.buildService.build(validation.data);
      return ToolResult.fromBuildResult(result);
    } catch (error) {
      return ToolResult.error(error);
    }
  }
}

// Factory for production dependencies
function createDefaultBuildService(): BuildService {
  return new BuildService(
    new ShellCommandExecutor(),
    new XcodeProjectValidator(),
    new SimulatorDeviceManager()
  );
}
```

## Testing Strategy with New Architecture

### 1. Unit Tests (Fast, Focused)
```typescript
describe('BuildService', () => {
  test('should create correct build command', () => {
    const mockExecutor = createMockCommandExecutor();
    const service = new BuildService(mockExecutor, ...);
    
    await service.build(new BuildRequest({
      projectPath: '/test/project.xcodeproj',
      scheme: 'MyApp'
    }));
    
    expect(mockExecutor.execute).toHaveBeenCalledWith(
      expect.stringContaining('xcodebuild -project "/test/project.xcodeproj" -scheme "MyApp"')
    );
  });
});
```

### 2. Integration Tests (Adapter Testing)
```typescript
describe('ShellCommandExecutor', () => {
  test('should execute commands and return results', async () => {
    const executor = new ShellCommandExecutor();
    const result = await executor.execute('echo "test"');
    
    expect(result.stdout).toBe('test\n');
    expect(result.exitCode).toBe(0);
  });
});
```

### 3. E2E Tests (Critical Paths Only)
```typescript
describe('Build E2E', () => {
  test('should build real project', async () => {
    const tool = new BuildXcodeTool(); // Uses real dependencies
    const result = await tool.execute({
      projectPath: testProject,
      scheme: 'TestScheme'
    });
    
    expect(result.success).toBe(true);
  });
});
```

## Benefits of This Architecture

### 1. **Testability**
- Each layer can be tested independently
- Mock only at boundaries (ports)
- Fast unit tests for business logic
- Integration tests for adapters only

### 2. **Maintainability**
- Clear separation of concerns
- Business logic isolated from infrastructure
- Easy to understand and modify

### 3. **Flexibility**
- Easy to swap implementations (e.g., mock executor for tests)
- Can add new adapters without changing core logic
- Platform-specific implementations possible

### 4. **Performance**
- Unit tests run in milliseconds (no I/O)
- Integration tests only test adapters (focused)
- Minimal E2E tests needed (confidence from other layers)

## Migration Strategy

### Phase 1: Create Abstractions (Non-Breaking)
1. Define port interfaces
2. Create adapters that wrap existing implementations
3. No changes to existing tools yet

### Phase 2: Refactor One Tool (Proof of Concept)
1. Choose BuildXcodeTool as pilot
2. Refactor to use ports & adapters
3. Write comprehensive tests
4. Measure improvement

### Phase 3: Gradual Migration
1. Refactor remaining tools one by one
2. Share common ports/adapters
3. Remove old implementations

### Phase 4: Cleanup
1. Remove old test utilities
2. Update documentation
3. Establish patterns for new tools

## Estimated Impact

### Current State
- E2E Tests: 140 tests, ~47 minutes
- Unit Tests: 13 files, mocked at high level
- Integration Tests: Failed attempt, too complex

### After Refactoring
- E2E Tests: ~20 tests, ~5 minutes (critical paths only)
- Unit Tests: ~100 tests, <10 seconds (pure logic)
- Integration Tests: ~40 tests, ~30 seconds (adapters only)
- **Total: ~160 tests in <6 minutes** (vs 47 minutes)

## Key Decisions

1. **Use Dependency Injection** - Pass dependencies, don't create them
2. **Separate Validation** - Return errors, don't throw
3. **Pure Core** - No I/O in domain logic
4. **Thin Tools** - Tools are just orchestrators
5. **Test Pyramid** - Many unit tests, some integration, few E2E

## Next Steps

1. Get team buy-in on architecture direction
2. Create proof of concept with one tool
3. Measure improvements (test speed, maintainability)
4. Plan gradual migration if successful
5. Document patterns for consistency

## References

- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/) - Alistair Cockburn
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) - Robert C. Martin
- [Ports and Adapters Pattern](https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/) - Herberto Graça
- Testing Philosophy from `testing-philosophy.md`