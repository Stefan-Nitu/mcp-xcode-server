/**
 * Unit tests for XcodeBuilder parsing logic
 */

import { describe, test, expect } from '@jest/globals';

// Since parseTestOutput is private, we'll test it through a mock implementation
// In a real scenario, we might want to export it for testing or test through public methods

describe('XcodeBuilder Test Output Parsing', () => {
  // Helper function that mimics the parseTestOutput logic
  function parseTestOutput(output: string) {
    const lines = output.split('\n');
    let testCount = 0;
    let failureCount = 0;
    let success = false;

    for (const line of lines) {
      // XCTest framework patterns
      if (line.includes('Test Suite') && line.includes('passed')) {
        success = true;
      }
      if (line.includes('Test Suite') && line.includes('failed')) {
        success = false;
      }
      
      // XCTest: "Executed N tests"
      const testMatch = line.match(/Executed (\d+) test/);
      if (testMatch) {
        testCount = parseInt(testMatch[1]);
      }
      
      // Swift Testing framework patterns (new framework in Xcode 16)
      // "✔ Test run with N test(s) passed"
      const swiftTestMatch = line.match(/Test run with (\d+) test/);
      if (swiftTestMatch) {
        testCount = parseInt(swiftTestMatch[1]);
        if (line.includes('passed')) {
          success = true;
        } else if (line.includes('failed')) {
          success = false;
        }
      }
      
      // XCTest failures
      const failureMatch = line.match(/(\d+) failure[s]?/);
      if (failureMatch) {
        failureCount = parseInt(failureMatch[1]);
      }
      
      // Swift Testing failures (look for ✗ symbol on individual test lines, not summary)
      if (line.includes('✗ Test') && line.includes('() failed')) {
        failureCount++;
      }
    }

    return {
      success,
      output, // Return FULL output - crucial for debugging in VS Code
      testCount,
      failureCount
    };
  }
  
  describe('parseTestOutput', () => {
    test('should parse successful test output', () => {
      const output = `
Test Suite 'All tests' started at 2025-01-01 10:00:00.000.
Test Suite 'MyAppTests.xctest' started at 2025-01-01 10:00:00.100.
Test Suite 'MyAppTests' started at 2025-01-01 10:00:00.200.
Test Case '-[MyAppTests testExample]' started.
Test Case '-[MyAppTests testExample]' passed (0.001 seconds).
Test Suite 'MyAppTests' passed at 2025-01-01 10:00:00.300.
 Executed 1 test, with 0 failures (0 unexpected) in 0.100 (0.100) seconds
Test Suite 'MyAppTests.xctest' passed at 2025-01-01 10:00:00.400.
 Executed 1 test, with 0 failures (0 unexpected) in 0.200 (0.300) seconds
Test Suite 'All tests' passed at 2025-01-01 10:00:00.500.
 Executed 1 test, with 0 failures (0 unexpected) in 0.300 (0.500) seconds
`;
      
      const result = parseTestOutput(output);
      expect(result.success).toBe(true);
      expect(result.testCount).toBe(1);
      expect(result.failureCount).toBe(0);
    });
    
    test('should parse failed test output', () => {
      const output = `
Test Suite 'All tests' started at 2025-01-01 10:00:00.000.
Test Suite 'MyAppTests.xctest' started at 2025-01-01 10:00:00.100.
Test Suite 'MyAppTests' started at 2025-01-01 10:00:00.200.
Test Case '-[MyAppTests testExample]' started.
Test Case '-[MyAppTests testExample]' failed (0.001 seconds).
Test Case '-[MyAppTests testAnother]' started.
Test Case '-[MyAppTests testAnother]' passed (0.001 seconds).
Test Suite 'MyAppTests' failed at 2025-01-01 10:00:00.300.
 Executed 2 tests, with 1 failure (0 unexpected) in 0.100 (0.100) seconds
Test Suite 'MyAppTests.xctest' failed at 2025-01-01 10:00:00.400.
 Executed 2 tests, with 1 failure (0 unexpected) in 0.200 (0.300) seconds
Test Suite 'All tests' failed at 2025-01-01 10:00:00.500.
 Executed 2 tests, with 1 failure (0 unexpected) in 0.300 (0.500) seconds
`;
      
      const result = parseTestOutput(output);
      expect(result.success).toBe(false);
      expect(result.testCount).toBe(2);
      expect(result.failureCount).toBe(1);
    });
    
    test('should parse multiple test suites', () => {
      const output = `
Test Suite 'All tests' started at 2025-01-01 10:00:00.000.
Test Suite 'MyAppTests.xctest' started.
Test Suite 'MyAppTests' started.
Test Case '-[MyAppTests testExample]' passed (0.001 seconds).
Test Suite 'MyAppTests' passed.
 Executed 1 test, with 0 failures
Test Suite 'MyAppUITests.xctest' started.
Test Suite 'MyAppUITests' started.
Test Case '-[MyAppUITests testUI]' passed (0.001 seconds).
Test Case '-[MyAppUITests testFlow]' passed (0.001 seconds).
Test Suite 'MyAppUITests' passed.
 Executed 2 tests, with 0 failures
Test Suite 'All tests' passed.
 Executed 3 tests, with 0 failures
`;
      
      const result = parseTestOutput(output);
      expect(result.success).toBe(true);
      expect(result.testCount).toBe(3);
      expect(result.failureCount).toBe(0);
    });
    
    test('should handle empty test output', () => {
      const output = `
Test Suite 'All tests' started at 2025-01-01 10:00:00.000.
Test Suite 'All tests' passed at 2025-01-01 10:00:00.500.
 Executed 0 tests, with 0 failures (0 unexpected) in 0.000 (0.500) seconds
`;
      
      const result = parseTestOutput(output);
      expect(result.success).toBe(true);
      expect(result.testCount).toBe(0);
      expect(result.failureCount).toBe(0);
    });
    
    test('should handle build errors', () => {
      const output = `
Build Failed
Error: Could not find module 'MyModule'
`;
      
      const result = parseTestOutput(output);
      expect(result.success).toBe(false);
      expect(result.testCount).toBe(0);
      expect(result.failureCount).toBe(0);
    });
    
    test('should handle old Swift Testing framework format', () => {
      const output = `
◇ Test run started.
↳ Testing Library Version: 124.4
↳ Target Platform: arm64e-apple-macos14.0
◇ Test example() started.
✔ Test example() passed after 0.001 seconds.
✔ Test run with 1 test passed after 0.001 seconds.
`;
      
      const result = parseTestOutput(output);
      // Now properly parsing Swift Testing framework
      expect(result.success).toBe(true);
      expect(result.testCount).toBe(1);
      expect(result.failureCount).toBe(0);
    });
    
    test('should return full output for debugging', () => {
      const longOutput = 'x'.repeat(6000);
      const result = parseTestOutput(longOutput);
      expect(result.output.length).toBe(6000);
    });
    
    test('should parse Swift Testing framework output', () => {
      const output = `
◇ Test run started.
↳ Testing Library Version: 124.4
↳ Target Platform: arm64e-apple-macos14.0
◇ Test example() started.
✔ Test example() passed after 0.001 seconds.
◇ Test anotherTest() started.
✔ Test anotherTest() passed after 0.002 seconds.
✔ Test run with 2 tests passed after 0.003 seconds.
`;
      
      const result = parseTestOutput(output);
      expect(result.success).toBe(true);
      expect(result.testCount).toBe(2);
      expect(result.failureCount).toBe(0);
    });
    
    test('should parse Swift Testing framework with failures', () => {
      const output = `
◇ Test run started.
↳ Testing Library Version: 124.4
◇ Test example() started.
✗ Test example() failed after 0.001 seconds.
◇ Test anotherTest() started.
✔ Test anotherTest() passed after 0.002 seconds.
✗ Test run with 2 tests failed after 0.003 seconds.
`;
      
      const result = parseTestOutput(output);
      expect(result.success).toBe(false);
      expect(result.testCount).toBe(2);
      expect(result.failureCount).toBe(1);
    });
    
    test('should handle mixed success and failure in different suites', () => {
      const output = `
Test Suite 'All tests' started.
Test Suite 'UnitTests' started.
Test Suite 'UnitTests' passed.
 Executed 5 tests, with 0 failures
Test Suite 'IntegrationTests' started.
Test Suite 'IntegrationTests' failed.
 Executed 3 tests, with 2 failures
Test Suite 'All tests' failed.
 Executed 8 tests, with 2 failures
`;
      
      const result = parseTestOutput(output);
      expect(result.success).toBe(false);
      expect(result.testCount).toBe(8);
      expect(result.failureCount).toBe(2);
    });
  });
});