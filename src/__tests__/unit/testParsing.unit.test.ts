/**
 * Unit tests for test parsing strategies
 * Tests the Strategy pattern implementation for parsing test outputs
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { XCTestParserStrategy } from '../../utils/testParsing/XCTestParserStrategy.js';
import { SwiftTestingParserStrategy } from '../../utils/testParsing/SwiftTestingParserStrategy.js';
import { TestOutputParser } from '../../utils/testParsing/TestOutputParser.js';

describe('XCTestParserStrategy', () => {
  let strategy: XCTestParserStrategy;

  beforeEach(() => {
    strategy = new XCTestParserStrategy();
  });

  describe('canParse', () => {
    test('should recognize XCTest output', () => {
      const xcTestOutput = 'Test Suite "MyTests" started at 2024-01-01';
      expect(strategy.canParse(xcTestOutput)).toBe(true);
    });

    test('should not recognize Swift Testing output', () => {
      const swiftTestingOutput = '◇ Test run started.';
      expect(strategy.canParse(swiftTestingOutput)).toBe(false);
    });
  });

  describe('parse', () => {
    test('should parse successful test run', () => {
      const output = `
Test Suite 'All tests' started at 2024-01-01 10:00:00.000
Test Suite 'MyTests' started at 2024-01-01 10:00:00.100
Test Case '-[MyTests testExample1]' started.
Test Case '-[MyTests testExample1]' passed (0.001 seconds).
Test Case '-[MyTests testExample2]' started.
Test Case '-[MyTests testExample2]' passed (0.002 seconds).
Test Suite 'MyTests' passed at 2024-01-01 10:00:00.200.
     Executed 2 tests, with 0 failures (0 unexpected) in 0.003 (0.100) seconds
** TEST SUCCEEDED **
      `;

      const result = strategy.parse(output);
      expect(result.success).toBe(true);
      expect(result.passed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.failingTests).toBeUndefined();
    });

    test('should parse failed test run with failing test names', () => {
      const output = `
Test Suite 'MyTests' started at 2024-01-01 10:00:00.000
Test Case '-[MyTests testExample1]' started.
Test Case '-[MyTests testExample1]' passed (0.001 seconds).
Test Case '-[MyTests testFailingExample]' started.
/path/to/test.swift:42: error: -[MyTests testFailingExample] : XCTAssertTrue failed
Test Case '-[MyTests testFailingExample]' failed (0.002 seconds).
Test Case '-[MyTests testAnotherFailure]' started.
/path/to/test.swift:50: error: -[MyTests testAnotherFailure] : XCTAssertEqual failed
Test Case '-[MyTests testAnotherFailure]' failed (0.001 seconds).
Test Suite 'MyTests' failed at 2024-01-01 10:00:00.200.
     Executed 3 tests, with 2 failures (0 unexpected) in 0.004 (0.200) seconds
** TEST FAILED **
      `;

      const result = strategy.parse(output);
      expect(result.success).toBe(false);
      expect(result.passed).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.failingTests).toEqual(['testFailingExample', 'testAnotherFailure']);
    });

    test('should handle multiple test bundles', () => {
      const output = `
Test Suite 'MyAppTests' passed at 2024-01-01 10:00:00.100.
     Executed 5 tests, with 0 failures (0 unexpected) in 0.010 (0.100) seconds
Test Suite 'MyAppUITests' passed at 2024-01-01 10:00:00.200.
     Executed 3 tests, with 0 failures (0 unexpected) in 5.000 (5.100) seconds
** TEST SUCCEEDED **
      `;

      const result = strategy.parse(output);
      expect(result.success).toBe(true);
      expect(result.passed).toBe(8);
      expect(result.failed).toBe(0);
    });

    test('should handle mixed results from multiple bundles', () => {
      const output = `
Test Suite 'UnitTests' failed at 2024-01-01 10:00:00.100.
     Executed 10 tests, with 2 failures (0 unexpected) in 0.020 (0.100) seconds
Test Suite 'IntegrationTests' passed at 2024-01-01 10:00:00.200.
     Executed 5 tests, with 0 failures (0 unexpected) in 1.000 (1.100) seconds
** TEST FAILED **
      `;

      const result = strategy.parse(output);
      expect(result.success).toBe(false);
      expect(result.passed).toBe(13);
      expect(result.failed).toBe(2);
    });

    test('should handle output without clear test results', () => {
      const output = 'Some test output without clear markers';
      
      const result = strategy.parse(output);
      // The behavior we care about: it should not report success when unclear
      expect(result.success).toBe(false);
    });
  });
});

describe('SwiftTestingParserStrategy', () => {
  let strategy: SwiftTestingParserStrategy;

  beforeEach(() => {
    strategy = new SwiftTestingParserStrategy();
  });

  describe('canParse', () => {
    test('should recognize Swift Testing output', () => {
      const swiftTestingOutput = '◇ Test run started.';
      expect(strategy.canParse(swiftTestingOutput)).toBe(true);
    });

    test('should not recognize XCTest output', () => {
      const xcTestOutput = 'Test Suite "MyTests" started';
      expect(strategy.canParse(xcTestOutput)).toBe(false);
    });
  });

  describe('parse', () => {
    test('should parse successful test run', () => {
      const output = `
◇ Test run started.
◇ Suite "MyTests" started.
◇ Test "testExample1" started.
✔ Test "testExample1" passed after 0.001 seconds.
◇ Test "testExample2" started.
✔ Test "testExample2" passed after 0.002 seconds.
✔ Suite "MyTests" passed after 0.003 seconds.
✔ Test run with 2 tests passed after 0.003 seconds.
      `;

      const result = strategy.parse(output);
      expect(result.success).toBe(true);
      expect(result.passed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.failingTests).toBeUndefined();
    });

    test('should parse failed test run with failing test names', () => {
      const output = `
◇ Test run started.
◇ Suite "MyTests" started.
◇ Test "testExample1" started.
✔ Test "testExample1" passed after 0.001 seconds.
◇ Test "testFailingExample" started.
✘ Test "testFailingExample" failed after 0.002 seconds.
  ✘ Issue: XCTAssertTrue failed at test.swift:42:8
◇ Test "testAnotherFailure" started.
✘ Test "testAnotherFailure" failed after 0.001 seconds.
  ✘ Issue: Expectation failed at test.swift:50:8
✘ Suite "MyTests" failed after 0.004 seconds.
✘ Test run with 3 tests (1 passed, 2 failed) after 0.004 seconds.
      `;

      const result = strategy.parse(output);
      expect(result.success).toBe(false);
      expect(result.passed).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.failingTests).toEqual(['testFailingExample', 'testAnotherFailure']);
    });

    test('should parse summary line format', () => {
      const output = `
◇ Test run started.
[Test output details...]
✔ Test run with 10 tests passed after 0.100 seconds.
      `;

      const result = strategy.parse(output);
      expect(result.success).toBe(true);
      expect(result.passed).toBe(10);
      expect(result.failed).toBe(0);
    });

    test('should correctly identify when tests have failed', () => {
      const output = `
◇ Test run started.
[Test output details...]
✘ Test run with 15 tests (12 passed, 3 failed) after 0.200 seconds.
      `;

      const result = strategy.parse(output);
      // The behavior we care about: it identified failures
      expect(result.success).toBe(false);
      expect(result.failed).toBeGreaterThan(0);
    });

    test('should identify failing tests by name', () => {
      const output = `
◇ Test "test1" started.
✔ Test "test1" passed after 0.001 seconds.
◇ Test "test2" started.
✘ Test "test2" failed after 0.002 seconds.
◇ Test "test3" started.
✔ Test "test3" passed after 0.001 seconds.
      `;

      const result = strategy.parse(output);
      // The behavior we care about: it identified the failure and knows which test failed
      expect(result.success).toBe(false);
      expect(result.failingTests).toContain('test2');
    });
  });
});

describe('TestOutputParser', () => {
  let parser: TestOutputParser;

  beforeEach(() => {
    parser = new TestOutputParser();
  });

  describe('parse', () => {
    test('should use XCTestParserStrategy for XCTest output', () => {
      const xcTestOutput = `
Test Suite 'MyTests' started at 2024-01-01 10:00:00.000
Test Case '-[MyTests testExample]' started.
Test Case '-[MyTests testExample]' passed (0.001 seconds).
Test Suite 'MyTests' passed at 2024-01-01 10:00:00.100.
     Executed 1 test, with 0 failures (0 unexpected) in 0.001 (0.100) seconds
** TEST SUCCEEDED **
      `;

      const result = parser.parse(xcTestOutput);
      expect(result.success).toBe(true);
      expect(result.passed).toBe(1);
      expect(result.failed).toBe(0);
    });

    test('should use SwiftTestingParserStrategy for Swift Testing output', () => {
      const swiftTestingOutput = `
◇ Test run started.
◇ Test "testExample" started.
✔ Test "testExample" passed after 0.001 seconds.
✔ Test run with 1 test passed after 0.001 seconds.
      `;

      const result = parser.parse(swiftTestingOutput);
      expect(result.success).toBe(true);
      expect(result.passed).toBe(1);
      expect(result.failed).toBe(0);
    });

    test('should fallback to basic parsing for unrecognized output', () => {
      const unknownOutput = `
Building project...
Compiling sources...
Linking executable...
Build succeeded
Running some custom test framework
All good!
      `;

      const result = parser.parse(unknownOutput);
      // Fallback parser should detect success keywords
      expect(result.success).toBe(true);
      expect(result.passed).toBe(0);
      expect(result.failed).toBe(0);
    });

    test('should detect failure in fallback parsing', () => {
      const failedOutput = `
Building project...
Error: Compilation failed
Test execution aborted
      `;

      const result = parser.parse(failedOutput);
      // The behavior we care about: it detected the failure
      expect(result.success).toBe(false);
    });

    test('should treat empty output as failure', () => {
      const result = parser.parse('');
      // The behavior we care about: empty output is not success
      expect(result.success).toBe(false);
    });

    test('should handle output with both frameworks (picks first match)', () => {
      // In practice this shouldn't happen, but test the behavior
      const mixedOutput = `
◇ Test run started.
Test Suite 'MyTests' started at 2024-01-01 10:00:00.000
      `;

      const result = parser.parse(mixedOutput);
      // SwiftTestingParserStrategy is first in the array, so it should be used
      expect(result).toBeDefined();
      expect(typeof result.passed).toBe('number');
      expect(typeof result.failed).toBe('number');
    });
  });

  describe('integration with real-world output', () => {
    test('should parse actual XCTest failure output', () => {
      const realOutput = `
Test Suite 'TestProjectXCTestTests' started at 2024-01-01 10:00:00.000
Test Case '-[TestProjectXCTestTests testPassing]' started.
Test Case '-[TestProjectXCTestTests testPassing]' passed (0.001 seconds).
Test Case '-[TestProjectXCTestTests testFailingTest]' started.
/Users/test/TestProjectXCTestTests.swift:25: error: -[TestProjectXCTestTests testFailingTest] : XCTAssertTrue failed
Test Case '-[TestProjectXCTestTests testFailingTest]' failed (0.001 seconds).
Test Suite 'TestProjectXCTestTests' failed at 2024-01-01 10:00:00.002.
     Executed 2 tests, with 1 failure (0 unexpected) in 0.002 (0.002) seconds
** TEST FAILED **
      `;

      const result = parser.parse(realOutput);
      // The behavior we care about: it correctly identified the failure and the failing test
      expect(result.success).toBe(false);
      expect(result.failingTests).toBeDefined();
      expect(result.failingTests?.length).toBeGreaterThan(0);
    });

    test('should parse actual Swift Testing output', () => {
      const realOutput = `
◇ Test run started.
◇ Running tests in TestSwiftPackageSwiftTestingTests
◇ Suite TestSwiftPackageSwiftTestingTests started.
◇ Test testExample() started.
✔ Test testExample() passed after 0.001 seconds.
◇ Test testAsyncExample() started.
✔ Test testAsyncExample() passed after 1.002 seconds.
✔ Suite TestSwiftPackageSwiftTestingTests passed after 1.003 seconds.
✔ Test run with 2 tests passed after 1.003 seconds.
      `;

      const result = parser.parse(realOutput);
      expect(result.success).toBe(true);
      expect(result.passed).toBe(2);
      expect(result.failed).toBe(0);
    });
  });
});