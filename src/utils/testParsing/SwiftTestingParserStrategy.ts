import { TestParserStrategy, TestResult } from './TestParserStrategy.js';
import { createModuleLogger } from '../../logger.js';

const logger = createModuleLogger('SwiftTestingParserStrategy');

/**
 * Parser strategy for Swift Testing framework output
 */
export class SwiftTestingParserStrategy implements TestParserStrategy {
  canParse(output: string): boolean {
    // Swift Testing specific patterns
    return output.includes('◇') ||  // Test started symbol
           output.includes('✔') ||  // Test passed symbol  
           output.includes('✘') ||  // Test failed symbol
           output.includes('Test run started') ||
           output.includes('Test run with') ||
           output.includes('Testing Library Version') ||
           output.includes('recorded an issue');
  }
  
  parse(output: string): TestResult {
    let passed = 0;
    let failed = 0;
    const failingTests: string[] = [];
    
    // Try to find the test summary
    // Format: "✔ Test run with X tests passed after Y seconds."
    // Or: "✘ Test run with X tests (Y passed, Z failed) after W seconds."
    const passedSummaryMatch = output.match(/✔ Test run with (\d+) tests? passed/);
    const mixedSummaryMatch = output.match(/✘ Test run with \d+ tests? \((\d+) passed, (\d+) failed\)/);
    const failedOnlyMatch = output.match(/✘ Test run with (\d+) tests? failed/);
    
    if (passedSummaryMatch) {
      passed = parseInt(passedSummaryMatch[1], 10);
      failed = 0;
      logger.debug({ passed, failed }, 'Parsed Swift Testing passed summary');
    } else if (mixedSummaryMatch) {
      // Mixed results format: "X tests (Y passed, Z failed)"
      passed = parseInt(mixedSummaryMatch[1], 10);
      failed = parseInt(mixedSummaryMatch[2], 10);
      logger.debug({ passed, failed }, 'Parsed Swift Testing mixed summary');
    } else if (failedOnlyMatch) {
      // When tests fail, it might only report the total number
      const total = parseInt(failedOnlyMatch[1], 10);
      
      // Try to count passed tests by looking for ✔ symbols
      const passedTests = output.match(/✔ Test "[^"]+" passed/g);
      passed = passedTests ? passedTests.length : 0;
      failed = total - passed;
      
      logger.debug({ total, passed, failed }, 'Parsed Swift Testing failed summary');
    } else {
      // Fallback: Count individual test results by symbols
      const passedTests = output.match(/✔ Test "[^"]+" passed/g);
      const failedTests = output.match(/✘ Test "[^"]+" failed/g);
      passed = passedTests ? passedTests.length : 0;
      failed = failedTests ? failedTests.length : 0;
      
      logger.debug({ passed, failed }, 'Parsed Swift Testing by counting symbols');
    }
    
    // Extract failing test names
    // Format: "✘ Test "testName" failed after X seconds."
    const failedTestMatches = output.matchAll(/✘ Test "([^"]+)" failed/g);
    for (const match of failedTestMatches) {
      const testName = match[1];
      failingTests.push(testName);
    }
    
    // Also check for the format with parentheses: "✘ Test testName() failed"
    const parenFormatMatches = output.matchAll(/✘ Test (\w+)\(\) failed/g);
    for (const match of parenFormatMatches) {
      const testName = match[1];
      // Add if not already present
      if (!failingTests.includes(testName)) {
        failingTests.push(testName);
      }
    }
    
    logger.info({ passed, failed, failingTests: failingTests.length }, 'Swift Testing parsing complete');
    
    return {
      success: failed === 0,
      passed,
      failed,
      failingTests: failingTests.length > 0 ? failingTests : undefined
    };
  }
}