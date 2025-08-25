import { TestParserStrategy, TestResult } from './TestParserStrategy.js';
import { createModuleLogger } from '../../logger.js';

const logger = createModuleLogger('XCTestParserStrategy');

/**
 * Parser strategy for XCTest framework output
 */
export class XCTestParserStrategy implements TestParserStrategy {
  canParse(output: string): boolean {
    // XCTest specific patterns
    return output.includes('Test Suite') || 
           output.includes('Test Case') ||
           output.includes('** TEST SUCCEEDED **') ||
           output.includes('** TEST FAILED **') ||
           output.includes('XCTest') ||
           output.includes('XCTAssert') ||
           output.includes('XCTFail') ||
           // Also check for the summary format
           /Executed \d+ tests?/.test(output);
  }
  
  parse(output: string): TestResult {
    let passed = 0;
    let failed = 0;
    const failingTests: string[] = [];
    
    // Try to find the test summary (most reliable)
    // When multiple test bundles run (UI tests + Unit tests), each has its own summary
    // We need to SUM them all to get the total counts
    // Look for patterns like:
    // "Test Suite 'MyTests' passed/failed ... Executed X tests, with Y failures"
    const allExecutedMatches = [...output.matchAll(/Executed (\d+) tests?, with (\d+) failures?/gm)];
    
    if (allExecutedMatches.length > 0) {
      // Sum all test results from all bundles
      let totalTests = 0;
      let totalFailed = 0;
      
      for (const match of allExecutedMatches) {
        const tests = parseInt(match[1], 10);
        const failures = parseInt(match[2], 10);
        totalTests += tests;
        totalFailed += failures;
      }
      
      passed = totalTests - totalFailed;
      failed = totalFailed;
      
      logger.debug({ totalTests, passed, failed, bundles: allExecutedMatches.length }, 'Parsed XCTest summaries');
    } else {
      // Fallback: Count individual test passes/failures
      const passedMatches = output.match(/Test Case .* passed/g);
      const failedMatches = output.match(/Test Case .* failed/g);
      passed = passedMatches ? passedMatches.length : 0;
      failed = failedMatches ? failedMatches.length : 0;
      
      logger.debug({ passed, failed }, 'Parsed XCTest by counting individual tests');
    }
    
    // Extract failing test names
    // Format: Test Case '-[TestClass testMethod]' failed
    const bracketFormatMatches = output.matchAll(/Test Case '\-\[([^\]]+)\]' failed/g);
    for (const match of bracketFormatMatches) {
      let testName = match[1];
      // Extract just the method name from "TestClass testMethod"
      const parts = testName.split(' ');
      if (parts.length >= 2) {
        failingTests.push(parts[1]);
      }
    }
    
    // Also try the format: Test Case 'TestTarget.TestClass/testMethod' failed
    const modernFormatMatches = output.matchAll(/Test Case '([^']+)' failed/g);
    for (const match of modernFormatMatches) {
      const testName = match[1];
      // Don't add duplicates
      if (!failingTests.includes(testName) && !testName.startsWith('-[')) {
        failingTests.push(testName);
      }
    }
    
    logger.info({ passed, failed, failingTests: failingTests.length }, 'XCTest parsing complete');
    
    return {
      success: failed === 0 && (passed > 0 || output.includes('** TEST SUCCEEDED **')),
      passed,
      failed,
      failingTests: failingTests.length > 0 ? failingTests : undefined
    };
  }
}