# Test Optimization Plan

## Overview
This document tracks the categorization and conversion of e2e tests to improve test suite performance.

**Goal**: Reduce e2e tests from 145 to ~29, reduce runtime from 47 minutes to <10 minutes.

**Current Status** (as of 2025-08-29):
- ✅ Created mock utilities for subprocess and filesystem operations
- ✅ Converted first test (bootSimulator) to unit test as proof of concept
- ✅ Fixed Jest TypeScript mocking issues and documented best practices
- 🚧 144 tests remaining to be optimized

## Categorization Legend
- **KEEP**: Must remain as e2e test (tests actual Xcode/simulator interaction)
- **CONVERT**: Can be converted to unit test (tests logic/validation)
- **ELIMINATE**: Redundant or low-value test

---

## Test Files Analysis

### 1. `boot-simulator.e2e.test.ts` (9 tests)
| Test | Current Type | Decision | Reason |
|------|--------------|----------|---------|
| should boot a simulator by UDID | E2E | KEEP | Core functionality - needs real simulator |
| should boot a simulator by name | E2E | ELIMINATE | Redundant with UDID test |
| should handle already booted simulator gracefully | E2E | CONVERT | Can mock simctl response |
| should fail with missing deviceId | E2E | CONVERT | Validation test |
| should fail with empty deviceId | E2E | CONVERT | Validation test |
| should fail with non-existent device | E2E | CONVERT | Can mock error response |
| should open Simulator.app when booting | E2E | ELIMINATE | Side effect, not critical |
| should boot multiple simulators sequentially | E2E | ELIMINATE | Redundant with single boot |
| should boot simulator within reasonable time | E2E | ELIMINATE | Unreliable in CI |

**Summary**: Keep 1, Convert 4, Eliminate 4

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

### Total Tests: 145
- **KEEP**: 29 tests (20%)
- **CONVERT**: 64 tests (44%)
- **ELIMINATE**: 52 tests (36%)

### Expected Outcome
- E2E tests: 29 (down from 145)
- New unit tests: ~64
- Eliminated redundant tests: 52
- Estimated runtime: <10 minutes (down from 47 minutes)

### Conversion Priority
1. **High Priority** (Quick wins):
   - Validation tests (all "require parameter" tests)
   - Error message formatting tests
   - Path validation tests

2. **Medium Priority** (Some refactoring needed):
   - Mock simctl responses
   - Mock xcodebuild errors
   - Configuration variants

3. **Low Priority** (Can wait):
   - Platform variants
   - Complex error scenarios
   - Performance tests

### Implementation Progress

#### Completed Conversions
1. **bootSimulator.unit.test.ts** ✅
   - Converted from e2e to unit test
   - Uses dependency injection for mocking
   - Runtime: ~2s (down from 30-60s)
   - Demonstrates proper Jest TypeScript patterns

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
2. Start converting high-priority validation tests (in progress)
3. Remove eliminated tests
4. Add integration test layer for command building
5. Run full suite and measure improvement

### Files to Convert Next (High Priority)
1. All validation tests ("require parameter" tests) - 15 tests
2. Error message formatting tests - 8 tests
3. Path validation tests - 10 tests
4. Mock simctl response tests - 12 tests
5. Mock xcodebuild error tests - 19 tests