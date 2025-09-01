# Test Optimization Plan

## Overview
This document tracks the categorization and conversion of e2e tests to improve test suite performance.

**Goal**: Reduce e2e tests from 140 to ~29, reduce runtime from 47 minutes to <10 minutes.

**Current Status** (as of 2025-09-01):
- ✅ Created mock utilities for subprocess and filesystem operations (mockHelpers.ts)
- ✅ Created 13 new unit test files (not converted from e2e yet)
- ✅ Fixed Jest TypeScript mocking issues and documented best practices
- ⚠️ E2E tests remain at 140 tests across 13 files (no conversions completed yet)
- 🚧 Need to start converting e2e tests to unit/integration tests

## Test Execution Time Analysis

Based on actual measurements, tests are prioritized by execution time:

### Tier 1 - Longest Running (Highest Priority for Optimization)
- **test-xcode.e2e.test.ts** - 14 tests
- **build-xcode.e2e.test.ts** - 13 tests  
- **run-xcode.e2e.test.ts** - 12 tests
- **test-swift-package.e2e.test.ts** - 12 tests
- **build-swift-package.e2e.test.ts** - 9 tests
- **run-swift-package.e2e.test.ts** - 10 tests

### Tier 2 - Medium Running
- **compile-errors.e2e.test.ts** - 14 tests
- **complex-errors.e2e.test.ts** - 6 tests

### Tier 3 - Shorter Running
- **clean-build.e2e.test.ts** - 10 tests
- **boot-simulator.e2e.test.ts** - 3 tests (already partially converted)
- **list-simulators.e2e.test.ts** - 12 tests
- **list-schemes.e2e.test.ts** - 14 tests
- **install-uninstall.e2e.test.ts** - 11 tests

## Categorization Legend
- **KEEP**: Must remain as e2e test (tests actual Xcode/simulator interaction)
- **CONVERT**: Can be converted to unit test (tests logic/validation)
- **ELIMINATE**: Redundant or low-value test

---

## Test Files Analysis

### 1. `boot-simulator.e2e.test.ts` (3 tests currently in E2E)
| Test | Current Type | Decision | Status |
|------|--------------|----------|---------|
| should boot a simulator by UDID | E2E | KEEP | 🔄 Remains in E2E |
| should boot a simulator by name | E2E | KEEP | 🔄 Remains in E2E |
| should handle already booted simulator gracefully | E2E | KEEP | 🔄 Remains in E2E |

**Note**: Original plan had 9 tests, but current implementation only has 3 tests. The validation and error tests may have been moved to unit tests during initial development.

### 2. `list-simulators.e2e.test.ts` (12 tests)
| Test | Current Type | Decision | Reason |
|------|--------------|----------|---------|
| should list simulators and return valid structure | E2E | KEEP | Core functionality |
| should show all simulators including unavailable | E2E | CONVERT | Can mock response |
| should filter simulators by iOS platform | E2E | CONVERT | Can mock filtered response |
| should filter simulators by each platform type | E2E | ELIMINATE | Test one platform is enough |
| should reject invalid platform | E2E | CONVERT | Validation test |
| should return empty array for macOS platform | E2E | CONVERT | Known behavior |
| should handle platform and showAll together | E2E | ELIMINATE | Combination testing |
| should return properly formatted JSON | E2E | CONVERT | Output formatting |
| should handle empty arguments | E2E | CONVERT | Validation test |
| should handle extra unknown parameters | E2E | CONVERT | Validation test |
| should format runtime strings correctly | E2E | CONVERT | String formatting |
| should complete within reasonable time | E2E | ELIMINATE | Performance test unreliable |

**Summary**: Keep 1, Convert 8, Eliminate 3

### 3. `build-xcode.e2e.test.ts` (13 tests)
| Test | Current Type | Decision | Reason |
|------|--------------|----------|---------|
| should build iOS project with scheme | E2E | KEEP | Core happy path |
| should require scheme parameter | E2E | CONVERT | Validation test |
| should build with Release configuration | E2E | KEEP | Important variant |
| should build with specific device | E2E | ELIMINATE | Covered by main test |
| should build workspace with scheme | E2E | KEEP | Different project type |
| should handle iOS platform (default) | E2E | ELIMINATE | Redundant with main test |
| should handle macOS platform | E2E | ELIMINATE | One platform test enough |
| should handle tvOS platform | E2E | ELIMINATE | One platform test enough |
| should handle watchOS platform | E2E | ELIMINATE | One platform test enough |
| should handle visionOS platform | E2E | ELIMINATE | One platform test enough |
| should handle non-existent project | E2E | CONVERT | Validation test |
| should handle invalid scheme | E2E | KEEP | Real error case |
| should handle custom configuration gracefully | E2E | ELIMINATE | Edge case |

**Summary**: Keep 4, Convert 2, Eliminate 7

### 4. `build-swift-package.e2e.test.ts` (9 tests)
| Test | Current Type | Decision | Reason |
|------|--------------|----------|---------|
| should build SPM package with default config | E2E | KEEP | Core functionality |
| should build SPM package with Release | E2E | ELIMINATE | Covered by default |
| should build SPM package from directory | E2E | ELIMINATE | Path handling |
| should build specific target if available | E2E | ELIMINATE | Edge case |
| should build specific product if available | E2E | ELIMINATE | Edge case |
| should handle non-existent SPM package | E2E | CONVERT | Validation |
| should handle broken SPM package | E2E | KEEP | Real error case |
| should handle invalid target | E2E | CONVERT | Can mock |
| should handle invalid product | E2E | CONVERT | Can mock |

**Summary**: Keep 2, Convert 3, Eliminate 4

### 5. `run-xcode.e2e.test.ts` (12 tests)
| Test | Current Type | Decision | Reason |
|------|--------------|----------|---------|
| should run iOS project on booted simulator | E2E | KEEP | Core functionality |
| should run project on specific device | E2E | ELIMINATE | Redundant |
| should run macOS project | E2E | ELIMINATE | Platform variant |
| should handle tvOS platform | E2E | ELIMINATE | Platform variant |
| should handle watchOS platform | E2E | ELIMINATE | Platform variant |
| should handle visionOS platform | E2E | ELIMINATE | Platform variant |
| should run with Debug configuration | E2E | ELIMINATE | Default case |
| should run with Release configuration | E2E | ELIMINATE | Config variant |
| should run project from workspace | E2E | KEEP | Different setup |
| should handle non-existent project | E2E | CONVERT | Validation |
| should handle invalid scheme | E2E | CONVERT | Can mock |
| should require scheme parameter | E2E | CONVERT | Validation |

**Summary**: Keep 2, Convert 3, Eliminate 7

### 6. `test-xcode.e2e.test.ts` (14 tests)
| Test | Current Type | Decision | Reason |
|------|--------------|----------|---------|
| should run XCTest tests successfully | E2E | KEEP | Core functionality |
| should require scheme parameter | E2E | CONVERT | Validation |
| should run tests with Release config | E2E | ELIMINATE | Config variant |
| should run tests with specific device | E2E | ELIMINATE | Device variant |
| should filter tests by class | E2E | KEEP | Important feature |
| should filter tests by method | E2E | ELIMINATE | Covered by class |
| should run specific test target | E2E | ELIMINATE | Target variant |
| should run workspace tests | E2E | ELIMINATE | Covered elsewhere |
| should handle test failures gracefully | E2E | KEEP | Error handling |
| should handle invalid scheme | E2E | CONVERT | Can mock |
| should handle tvOS platform | E2E | ELIMINATE | Platform variant |
| should handle watchOS platform | E2E | ELIMINATE | Platform variant |
| should run Swift Testing tests | E2E | KEEP | Different framework |
| should handle both test frameworks | E2E | ELIMINATE | Redundant |

**Summary**: Keep 4, Convert 2, Eliminate 8

### 7. `test-swift-package.e2e.test.ts` (12 tests)
| Test | Current Type | Decision | Reason |
|------|--------------|----------|---------|
| should run all tests with default config | E2E | KEEP | Core functionality |
| should run tests with Release config | E2E | ELIMINATE | Config variant |
| should filter tests by class | E2E | ELIMINATE | Can unit test |
| should filter tests by specific method | E2E | ELIMINATE | Can unit test |
| should handle test failures | E2E | KEEP | Error case |
| should handle no tests found | E2E | CONVERT | Can mock |
| should handle non-existent package | E2E | CONVERT | Validation |
| should handle broken Package.swift | E2E | CONVERT | Can mock |
| should handle missing test targets | E2E | CONVERT | Can mock |
| should run tests from directory path | E2E | ELIMINATE | Path variant |
| should run tests from Package.swift path | E2E | ELIMINATE | Path variant |
| should support Swift Testing framework | E2E | ELIMINATE | Covered in main |

**Summary**: Keep 2, Convert 4, Eliminate 6

### 8. `run-swift-package.e2e.test.ts` (10 tests)
| Test | Current Type | Decision | Reason |
|------|--------------|----------|---------|
| should run default executable | E2E | KEEP | Core functionality |
| should run with arguments | E2E | ELIMINATE | Variant |
| should run specific executable | E2E | ELIMINATE | Variant |
| should run with Release config | E2E | ELIMINATE | Config variant |
| should handle package without executables | E2E | CONVERT | Can mock |
| should handle non-existent package | E2E | CONVERT | Validation |
| should handle build failure | E2E | CONVERT | Can mock |
| should handle runtime error | E2E | KEEP | Real error |
| should run from directory path | E2E | ELIMINATE | Path variant |
| should display output correctly | E2E | ELIMINATE | Output format |

**Summary**: Keep 2, Convert 3, Eliminate 5

### 9. `clean-build.e2e.test.ts` (10 tests)
| Test | Current Type | Decision | Reason |
|------|--------------|----------|---------|
| should clean build folder after actual build | E2E | KEEP | Verifies real cleanup |
| should clean workspace build | E2E | ELIMINATE | Variant |
| should fail when project path not provided | E2E | CONVERT | Validation |
| should remove DerivedData after build | E2E | KEEP | Important cleanup |
| should handle non-existent DerivedData | E2E | CONVERT | Can mock |
| should clean only test results | E2E | ELIMINATE | Specific case |
| should clean everything after build | E2E | ELIMINATE | Covered by others |
| should clean DerivedData if xcodebuild fails | E2E | CONVERT | Error case |
| should clean Swift package .build | E2E | ELIMINATE | SPM variant |
| should clean specific configuration | E2E | ELIMINATE | Config variant |

**Summary**: Keep 2, Convert 3, Eliminate 5

### 10. `install-uninstall.e2e.test.ts` (11 tests)
| Test | Current Type | Decision | Reason |
|------|--------------|----------|---------|
| should install and uninstall app | E2E | KEEP | Core functionality |
| should use booted simulator by default | E2E | ELIMINATE | Default case |
| should handle reinstalling same app | E2E | ELIMINATE | Edge case |
| should install/uninstall multiple apps | E2E | ELIMINATE | Variant |
| should handle non-existent app path | E2E | CONVERT | Validation |
| should handle uninstalling non-installed app | E2E | CONVERT | Can mock |
| should handle invalid bundle ID format | E2E | CONVERT | Validation |
| should handle invalid device ID | E2E | CONVERT | Can mock |
| should handle no booted devices for install | E2E | CONVERT | Can mock |
| should handle no booted devices for uninstall | E2E | CONVERT | Can mock |
| should handle concurrent operations | E2E | ELIMINATE | Complex scenario |

**Summary**: Keep 1, Convert 6, Eliminate 4

### 11. `compile-errors.e2e.test.ts` (13 tests)
| Test | Current Type | Decision | Reason |
|------|--------------|----------|---------|
| build_xcode should display compile errors | E2E | KEEP | Real error display |
| test_xcode should display compile errors | E2E | ELIMINATE | Same as build |
| run_xcode should display compile errors | E2E | ELIMINATE | Same as build |
| build_swift_package compile errors | E2E | KEEP | Different tool |
| test_swift_package compile errors | E2E | ELIMINATE | Same as build |
| should not show duplicate errors | E2E | CONVERT | Can unit test |
| should display scheme not found error | E2E | CONVERT | Can mock |
| should display configuration not found | E2E | CONVERT | Can mock |
| should display project not found | E2E | CONVERT | Validation |
| should display platform not supported | E2E | CONVERT | Can mock |
| should display package not found | E2E | CONVERT | Validation |
| should display invalid SPM config | E2E | CONVERT | Validation |
| all tools should display log path | E2E | CONVERT | Output format |

**Summary**: Keep 2, Convert 8, Eliminate 3

### 12. `complex-errors.e2e.test.ts` (6 tests)
| Test | Current Type | Decision | Reason |
|------|--------------|----------|---------|
| should handle injected type mismatch | E2E | KEEP | Complex scenario |
| should handle undefined variable | E2E | ELIMINATE | Similar to type |
| should handle code signing errors | E2E | ELIMINATE | Rare case |
| should handle dependency resolution | E2E | ELIMINATE | SPM specific |
| should recover after fixing error | E2E | ELIMINATE | Complex flow |
| should format errors consistently | E2E | CONVERT | Output format |

**Summary**: Keep 1, Convert 1, Eliminate 4

### 13. `list-schemes.e2e.test.ts` (14 tests)
| Test | Current Type | Decision | Reason |
|------|--------------|----------|---------|
| should list Xcode project schemes | E2E | KEEP | Core functionality |
| should handle project with no schemes | E2E | CONVERT | Can mock |
| should list shared schemes only | E2E | CONVERT | Can mock |
| should handle workspace schemes | E2E | ELIMINATE | Variant |
| should handle SPM schemes | E2E | ELIMINATE | Variant |
| should handle non-existent project | E2E | CONVERT | Validation |
| should handle invalid project type | E2E | CONVERT | Validation |
| should handle malformed project | E2E | CONVERT | Can mock |
| should handle permission errors | E2E | CONVERT | Can mock |
| should work with different project types | E2E | ELIMINATE | Redundant |
| should compare schemes across types | E2E | ELIMINATE | Complex |
| should complete within 2 seconds | E2E | ELIMINATE | Performance |
| should handle special characters | E2E | CONVERT | Can unit test |
| should handle deeply nested projects | E2E | ELIMINATE | Edge case |

**Summary**: Keep 1, Convert 7, Eliminate 6

---

## Summary Statistics

### Current State (2025-09-01)
- **Total E2E Tests**: 140 tests across 13 files (unchanged)
- **Unit Tests**: 13 test files exist (created separately, not converted from E2E)
- **Integration Tests**: 0 (to be created)
- **Longest Running**: test-xcode, build-xcode, run-xcode (Tier 1 priority)

### Target State
- **KEEP as E2E**: ~29 tests (20%)
- **CONVERT to Unit**: ~64 tests (46%)
- **ELIMINATE**: ~47 tests (34%)

### Expected Outcome
- E2E tests: 29 (down from 140)
- Total unit tests: ~77 (13 existing + 64 new)
- Eliminated redundant tests: 47
- Estimated runtime: <10 minutes (down from 47 minutes)

### Integration Test Layer Strategy

Following the Testing Trophy approach from testing-philosophy.md, we need to add an integration test layer:

#### Integration Tests (New Layer)
- **Purpose**: Test component interactions with mocked external boundaries
- **Mock only**: execAsync, file system, network calls
- **Keep real**: All internal components, services, and utilities
- **Target**: 60% of converted tests should become integration tests

#### Test Distribution Target
```
       /\
      /e2e\      <- 29 tests: Critical user paths (20%)
     /------\
    /  integ \   <- ~84 tests: Component interactions (60%)
   /----------\
  /    unit    \ <- ~27 tests: Pure logic, validation (20%)
 /--------------\
```

### Conversion Priority
1. **Tier 1 - Longest Running Tests** (Highest Impact):
   - Convert build-xcode tests → integration tests
   - Convert test-xcode tests → integration tests  
   - Convert run-xcode tests → integration tests
   - Keep 1-2 critical path tests as E2E per tool

2. **Tier 2 - Error Handling** (Medium Priority):
   - Convert compile-errors → integration tests
   - Convert complex-errors → integration tests
   - Test real error parsing with mocked subprocess

3. **Tier 3 - Quick Wins** (Low Hanging Fruit):
   - Validation tests → unit tests
   - Path handling → unit tests
   - Configuration parsing → unit tests

### Implementation Progress

#### Infrastructure Created
1. **mockHelpers.ts** ✅
   - SubprocessMock for mocking execSync/spawn
   - FilesystemMock for mocking fs operations
   - Common mock responses for Xcode/simulator commands
   - Helper functions for creating typed mocks

2. **jest-typescript-best-practices.md** ✅
   - Documents proper mock typing patterns
   - Explains Jest 27+ syntax changes
   - Provides troubleshooting guide
   - Real-world examples and case studies

### Next Steps
1. ~~Create mock utilities for subprocess and filesystem~~ ✅
2. ~~Document Jest TypeScript best practices~~ ✅
3. **Create integration test directory structure** (src/__tests__/integration/)
4. **Convert Tier 1 tests** (build-xcode, test-xcode, run-xcode) to integration tests
5. **Measure performance improvement** after first batch of conversions
6. **Remove redundant tests** identified in analysis

### Conversion Roadmap

#### Phase 1: Tier 1 Tests (Highest Impact)
Focus on the longest-running tests first for maximum performance gain:
1. **build-xcode.e2e.test.ts** (13 tests) → Keep 2 E2E, 9 Integration, 2 eliminated
2. **test-xcode.e2e.test.ts** (14 tests) → Keep 4 E2E, 8 Integration, 2 eliminated  
3. **run-xcode.e2e.test.ts** (12 tests) → Keep 2 E2E, 7 Integration, 3 eliminated

#### Phase 2: Swift Package Tests
4. **build-swift-package.e2e.test.ts** (9 tests) → Keep 2 E2E, 5 Integration, 2 eliminated
5. **test-swift-package.e2e.test.ts** (12 tests) → Keep 2 E2E, 6 Integration, 4 eliminated
6. **run-swift-package.e2e.test.ts** (10 tests) → Keep 2 E2E, 5 Integration, 3 eliminated

#### Phase 3: Error Handling Tests
7. **compile-errors.e2e.test.ts** (14 tests) → Keep 2 E2E, 10 Integration, 2 eliminated
8. **complex-errors.e2e.test.ts** (6 tests) → Keep 1 E2E, 4 Integration, 1 eliminated