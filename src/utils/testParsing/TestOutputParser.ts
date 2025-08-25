import { TestParserStrategy, TestResult } from './TestParserStrategy.js';
import { XCTestParserStrategy } from './XCTestParserStrategy.js';
import { SwiftTestingParserStrategy } from './SwiftTestingParserStrategy.js';
import { createModuleLogger } from '../../logger.js';

const logger = createModuleLogger('TestOutputParser');

/**
 * Main test output parser that uses strategy pattern to handle different test frameworks
 */
export class TestOutputParser {
  private strategies: TestParserStrategy[];
  
  constructor() {
    // Order matters: check Swift Testing first as it has more distinctive patterns
    this.strategies = [
      new SwiftTestingParserStrategy(),
      new XCTestParserStrategy()
    ];
  }
  
  /**
   * Parse test output using the appropriate strategy
   * @param output The test output to parse
   * @returns Parsed test results
   */
  parse(output: string): TestResult {
    // Check if both frameworks are present in the output
    const hasXCTest = output.includes('Test Suite') || output.includes('Executed') || output.includes('** TEST');
    const hasSwiftTesting = output.includes('◇') || output.includes('✔') || output.includes('✘');
    
    if (hasXCTest && hasSwiftTesting) {
      // Both frameworks ran, we need to combine results
      // Parse with both strategies and combine
      logger.debug('Both test frameworks detected, combining results');
      
      const xcTestResult = new XCTestParserStrategy().parse(output);
      const swiftTestingResult = new SwiftTestingParserStrategy().parse(output);
      
      // If Swift Testing reports 0 tests, it means no Swift Testing tests exist
      // Use only XCTest results in that case
      if (swiftTestingResult.passed === 0 && swiftTestingResult.failed === 0) {
        logger.debug('Swift Testing found no tests, using XCTest results only');
        return xcTestResult;
      }
      
      // If XCTest reports 0 tests, use only Swift Testing results
      if (xcTestResult.passed === 0 && xcTestResult.failed === 0) {
        logger.debug('XCTest found no tests, using Swift Testing results only');
        return swiftTestingResult;
      }
      
      // Both have tests, combine the results
      const combinedFailingTests = [
        ...(xcTestResult.failingTests || []),
        ...(swiftTestingResult.failingTests || [])
      ];
      
      return {
        success: xcTestResult.success && swiftTestingResult.success,
        passed: xcTestResult.passed + swiftTestingResult.passed,
        failed: xcTestResult.failed + swiftTestingResult.failed,
        failingTests: combinedFailingTests.length > 0 ? combinedFailingTests : undefined
      };
    }
    
    // Only one framework present, use the appropriate strategy
    for (const strategy of this.strategies) {
      if (strategy.canParse(output)) {
        logger.debug({ strategy: strategy.constructor.name }, 'Using parser strategy');
        return strategy.parse(output);
      }
    }
    
    // Fallback parsing if no strategy matches
    logger.warn('No specific parser strategy matched, using fallback');
    return this.fallbackParse(output);
  }
  
  /**
   * Fallback parsing for when no specific strategy matches
   * This provides basic parsing that works with most test output
   */
  private fallbackParse(output: string): TestResult {
    let passed = 0;
    let failed = 0;
    
    // Try to find any mention of passed/failed counts
    const passedMatch = output.match(/(\d+) (?:tests? )?passed/i);
    const failedMatch = output.match(/(\d+) (?:tests? )?failed/i);
    
    if (passedMatch) {
      passed = parseInt(passedMatch[1], 10);
    }
    if (failedMatch) {
      failed = parseInt(failedMatch[1], 10);
    }
    
    // If no counts found, just leave them as 0
    // The success/failure status will be determined by keywords
    
    logger.debug({ passed, failed }, 'Fallback parsing complete');
    
    // Determine success based on keywords if no counts found
    let success = failed === 0;
    if (passed === 0 && failed === 0) {
      // No counts found, check for success/failure keywords
      const hasError = output.toLowerCase().includes('error') || 
                       output.toLowerCase().includes('compilation failed');
      const hasFailure = output.toLowerCase().includes('failed') || 
                         output.toLowerCase().includes('failure');
      const hasSuccess = output.toLowerCase().includes('succeeded') || 
                         output.toLowerCase().includes('success');
      
      if (hasError || hasFailure) {
        success = false;
      } else if (hasSuccess) {
        success = true;
      } else {
        // No clear indication, default to false for empty or ambiguous output
        success = false;
      }
    }
    
    return {
      success,
      passed,
      failed
    };
  }
}

// Export a singleton instance for convenience
export const testOutputParser = new TestOutputParser();