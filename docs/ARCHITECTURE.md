# Clean/Hexagonal Architecture Documentation

## Overview

This document outlines the architectural principles and guidelines for organizing code following Clean Architecture (Uncle Bob) and Hexagonal Architecture (Ports & Adapters) patterns. These patterns ensure separation of concerns, testability, and maintainability by organizing code into distinct layers with clear responsibilities and dependencies.

## Core Principles

### 1. The Dependency Rule
**The most critical rule**: Dependencies can only point inward. Nothing in an inner circle can know anything about an outer circle. This includes variables, functions, classes, or any other software entities.

### 2. Dependency Inversion
High-level modules should not depend on low-level modules. Both should depend on abstractions (interfaces). The core business logic defines interfaces that the infrastructure implements.

### 3. Separation of Concerns
Each layer has a single, well-defined responsibility. Business logic is completely isolated from technical implementation details.

## Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                      │
│            (Controllers, CLI, API Routes, UI)               │
├─────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                     │
│      (Database, File System, External APIs, Frameworks)     │
├─────────────────────────────────────────────────────────────┤
│                    Application Layer                        │
│         (Use Cases, Application Services, DTOs)             │
├─────────────────────────────────────────────────────────────┤
│                      Domain Layer                           │
│        (Entities, Value Objects, Domain Services)           │
└─────────────────────────────────────────────────────────────┘
                            ↑
                    Dependencies Flow Inward
```

## Layer Responsibilities and Guidelines

### Domain Layer (Core - Innermost)
**Location**: `src/domain/`

**Purpose**: Contains the enterprise-wide business rules and core business logic that represents the problem domain.

**What Goes Here**:
- **Entities**: Core business objects with unique identities (e.g., `XcodeProject`, `BuildTarget`, `TestResult`)
- **Value Objects**: Immutable objects without identity (e.g., `BuildConfiguration`, `Version`, `FilePath`)
- **Domain Services**: Business logic that doesn't naturally fit within a single entity
- **Domain Events**: Important business events that have occurred
- **Repository Interfaces**: Contracts for data persistence (interfaces only, no implementations)
- **Domain Exceptions**: Business rule violations and domain-specific errors

**Rules**:
- NO dependencies on any other layer
- NO frameworks or external libraries
- NO infrastructure concerns (databases, file systems)
- Pure business logic only
- Must be testable in isolation

**Example Structure**:
```
src/domain/
├── entities/
│   ├── XcodeProject.ts
│   ├── BuildTarget.ts
│   └── TestResult.ts
├── valueObjects/
│   ├── BuildConfiguration.ts
│   ├── Platform.ts
│   └── Version.ts
├── services/
│   └── BuildValidationService.ts
├── repositories/
│   └── IProjectRepository.ts    # Interface only
└── exceptions/
    └── InvalidBuildConfigurationError.ts
```

### Application Layer
**Location**: `src/application/`

**Purpose**: Orchestrates the flow of data and coordinates domain objects to perform specific tasks. Contains application-specific business rules.

**What Goes Here**:
- **Use Cases**: Application-specific business rules and workflows (e.g., `BuildProjectUseCase`, `RunTestsUseCase`)
- **Application Services**: Services that coordinate multiple use cases
- **DTOs (Data Transfer Objects)**: Objects for transferring data between layers
- **Mappers**: Convert between domain entities and DTOs
- **Port Interfaces**: Contracts for external services (following Hexagonal Architecture)
- **Application Events**: Application-level events and their handlers
- **Validation**: Input validation for use cases

**Rules**:
- Depends ONLY on Domain layer
- Defines interfaces that Infrastructure will implement
- No knowledge of how data is persisted or external systems work
- Orchestrates but doesn't implement technical details
- Each use case should represent a single user intent

**Example Structure**:
```
src/application/
├── useCases/
│   ├── buildProject/
│   │   ├── BuildProjectUseCase.ts
│   │   ├── BuildProjectDTO.ts
│   │   └── BuildProjectValidator.ts
│   └── runTests/
│       ├── RunTestsUseCase.ts
│       └── RunTestsDTO.ts
├── services/
│   └── ProjectManagementService.ts
├── ports/
│   ├── IFileSystemService.ts      # Interface for infrastructure
│   ├── IXcodeBuildService.ts      # Interface for infrastructure
│   └── INotificationService.ts    # Interface for infrastructure
└── mappers/
    └── ProjectMapper.ts
```

### Infrastructure Layer
**Location**: `src/infrastructure/`

**Purpose**: Implements all technical details and external system integrations. Provides concrete implementations of interfaces defined in Application and Domain layers.

**What Goes Here**:
- **Repository Implementations**: Concrete implementations of domain repository interfaces
- **External Service Adapters**: Implementations of application port interfaces
- **Database/Persistence**: ORM configurations, database clients, migrations
- **File System Operations**: File reading/writing implementations
- **Framework Integrations**: Express, Fastify, MCP framework specific code
- **Third-party API Clients**: External service integrations
- **Configuration**: Environment variables, config files
- **Logging**: Concrete logging implementations
- **Monitoring/Metrics**: Performance monitoring, telemetry

**Rules**:
- Depends on Domain and Application layers
- Implements interfaces defined in inner layers
- Can use any framework or library
- Handles all I/O operations
- Adapts external systems to match application needs

**Example Structure**:
```
src/infrastructure/
├── repositories/
│   └── FileSystemProjectRepository.ts  # Implements IProjectRepository
├── services/
│   ├── XcodeBuildService.ts           # Implements IXcodeBuildService
│   ├── FileSystemService.ts           # Implements IFileSystemService
│   └── SlackNotificationService.ts    # Implements INotificationService
├── persistence/
│   ├── database/
│   └── cache/
├── external/
│   └── XcodeAPIClient.ts
├── config/
│   └── Configuration.ts
└── logging/
    └── WinstonLogger.ts
```

### Presentation Layer
**Location**: `src/presentation/`

**Purpose**: Handles all user interaction and presents data to users. Translates user input into application use case calls.

**What Goes Here**:
- **Controllers**: MCP tool controllers that define tool metadata and orchestrate flow
- **Presenters**: Complex output formatting for rich responses
- **Formatters**: Shared formatting utilities (error formatting, etc.)
- **Validators**: Reusable validation schemas
- **View Models**: Data structures optimized for presentation
- **Request/Response Models**: Protocol-specific request and response schemas

**Special Pattern for MCP Servers**:
In MCP servers, controllers serve dual purpose:
1. Define MCP tool metadata (name, description, input schema)
2. Orchestrate the flow (validate → use case → present)

This eliminates the need for separate Tool classes. Controllers ARE the tools.

**Rules**:
- Depends on Application layer (through use cases)
- No business logic - only presentation concerns
- Translates between external format and application DTOs
- Handles user input validation (format, not business rules)
- Can depend on Infrastructure for technical needs

**Example Structure**:
```
src/presentation/
├── controllers/       # MCP tool controllers
│   ├── BuildXcodeController.ts
│   └── InstallAppController.ts
├── presenters/        # Complex formatting (optional)
│   └── BuildXcodePresenter.ts
├── formatters/        # Shared formatting utilities
│   ├── ErrorFormatter.ts
│   └── strategies/
└── validation/        # Reusable validators
    └── ToolInputValidators.ts
```

**Controller Pattern**:
```typescript
// Controllers combine MCP tool definition with orchestration
export class BuildXcodeController {
  // MCP tool metadata
  name = 'build_xcode';
  description = 'Build an Xcode project';
  
  // MCP input schema (JSON Schema)
  get inputSchema() { /* ... */ }
  
  // Tool execution with validation and orchestration
  async execute(args: unknown) {
    // 1. Validate input (parse don't validate)
    const validated = schema.parse(args);
    
    // 2. Create domain objects
    const request = BuildRequest.create(...);
    
    // 3. Execute use case
    const result = await this.useCase.execute(request);
    
    // 4. Present result (use presenter for complex formatting)
    return this.presenter?.present(result) || this.formatSimple(result);
  }
}
```

**When to Use Presenters**:
- Use a separate Presenter class when formatting is complex (errors, warnings, truncation)
- For simple responses, format directly in the controller
- Always use ErrorFormatter for consistent error messages

## Additional Directories

### Factories
**Location**: `src/factories/`

**Purpose**: Creates and wires up all dependencies, implementing dependency injection patterns.

**What Goes Here**:
- Dependency injection containers
- Factory classes for complex object creation
- Application bootstrapping code

**MCP-Specific Pattern**:
Factories create controllers (which serve as MCP tools) with all their dependencies:
```typescript
export function createBuildXcodeController(): BuildXcodeController {
  // Create infrastructure
  const executor = new ShellCommandExecutorAdapter(promisify(exec));
  
  // Create use case
  const useCase = new BuildProjectUseCase(...);
  
  // Create presenter (if needed)
  const presenter = new BuildXcodePresenter();
  
  // Return controller that serves as MCP tool
  return new BuildXcodeController(useCase, presenter);
}
```


### Utils/Shared
**Location**: `src/utils/` or `src/shared/`

**Purpose**: Cross-cutting concerns and utilities used across layers.

**What Goes Here**:
- Generic utilities (not business-specific)
- Common types and interfaces
- Helper functions
- Constants

**Rules**:
- Should not contain business logic
- Should be layer-agnostic
- Minimize dependencies

## Best Practices

### 1. Interface Segregation
- Define narrow, focused interfaces
- Clients should not depend on methods they don't use
- Prefer multiple specific interfaces over one general interface

### 2. Use Case Design
- One use case per user intent
- Use cases should be independent of each other
- Name use cases clearly (e.g., `BuildProjectUseCase`, not `ProjectService`)

### 3. Testing Strategy
- **Domain Layer**: Unit tests with no mocks needed
- **Application Layer**: Unit tests with mocked infrastructure
- **Infrastructure Layer**: Integration tests with real external systems
- **Presentation Layer**: API/E2E tests

### 4. Dependency Injection
- Use constructor injection
- Dependencies flow from outer to inner layers
- Factories handle wiring at application startup

### 5. Error Handling
- Domain exceptions for business rule violations (data only, no messages)
- Application layer returns domain errors without formatting
- Infrastructure exceptions for technical failures
- Presentation layer formats all errors for user display

### 6. Type Safety and Enums
- Always use enum values for comparisons, not string literals
  - ✅ Good: `if (state === SimulatorState.Booted)`
  - ❌ Bad: `if (state === 'Booted')`
- Parse external data into domain types at system boundaries
- Use validation functions (e.g., `Platform.parse()`) to convert strings to enums
- This ensures type safety and catches invalid values early

## Migration Strategy

When refactoring existing code to Clean Architecture:

1. **Start with Domain**: Identify and extract pure business logic
2. **Create Use Cases**: Wrap existing functionality in use cases
3. **Define Interfaces**: Create contracts for external dependencies
4. **Implement Adapters**: Wrap existing infrastructure code
5. **Refactor Gradually**: Move code layer by layer, maintaining functionality

## Common Pitfalls to Avoid

1. **Leaking Domain Knowledge**: Don't let database schemas dictate domain models
2. **Anemic Domain Models**: Ensure entities contain behavior, not just data
3. **Use Case Bloat**: Keep use cases focused on a single responsibility
4. **Skipping Layers**: Don't bypass layers for convenience
5. **Framework Coupling**: Keep frameworks in Infrastructure/Presentation only
6. **Shared Mutable State**: Prefer immutability, especially in Domain layer
7. **Circular Dependencies**: Always respect the dependency rule

## Benefits of This Architecture

1. **Testability**: Each layer can be tested in isolation
2. **Maintainability**: Clear separation of concerns makes changes easier
3. **Flexibility**: Easy to swap implementations (database, frameworks)
4. **Team Scalability**: Teams can work on different layers independently
5. **Business Focus**: Domain logic is clear and framework-agnostic
6. **Longevity**: Business logic survives framework and technology changes