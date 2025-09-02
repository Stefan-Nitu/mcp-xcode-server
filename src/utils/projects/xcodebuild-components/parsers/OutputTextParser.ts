import { createModuleLogger } from '../../../../logger.js';
import { TestResult } from '../TestResultParser.js';

const logger = createModuleLogger('OutputTextParser');

/**
 * Parser for test output text as fallback
 * Single Responsibility: Parse test results from text output when xcresult is unavailable
 */
export class OutputTextParser {
  /**
   * Parse test results from output text
   */
  parse(output: string): TestResult {
    // Try to find "Executed X tests, with Y failures" pattern
    const summaryMatch = output.match(/Executed\s+(\d+)\s+tests?,\s+with\s+(\d+)\s+failures?/);
    if (summaryMatch) {
      const totalTests = parseInt(summaryMatch[1], 10);
      const failures = parseInt(summaryMatch[2], 10);
      
      logger.debug({ totalTests, failures }, 'Parsed test counts from output text');
      
      return {
        passed: totalTests - failures,
        failed: failures,
        success: failures === 0,
        failingTests: undefined
      };
    }
    
    // Last resort: check for failure indicators
    const hasFailed = output.toLowerCase().includes('failed') || 
                      output.includes('** TEST FAILED **') ||
                      output.includes('TEST FAILED');
    
    logger.warn('Using last resort parsing - checking for failure keywords');
    
    return {
      passed: hasFailed ? 0 : 1,
      failed: hasFailed ? 1 : 0,
      success: !hasFailed,
      failingTests: undefined
    };
  }
}