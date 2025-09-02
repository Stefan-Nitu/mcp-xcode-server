import { execSync } from 'child_process';
import { createModuleLogger } from '../../../../logger.js';
import { TestResult } from '../TestResultParser.js';

const logger = createModuleLogger('LegacyXcresultParser');

/**
 * Parser for legacy xcresult format (pre-Xcode 16)
 * Single Responsibility: Parse test results using legacy xcresulttool commands
 */
export class LegacyXcresultParser {
  /**
   * Parse test results using legacy xcresulttool format
   */
  async parse(resultBundlePath: string): Promise<TestResult> {
    const testReportJson = execSync(
      `xcrun xcresulttool get test-report --legacy --format json --path "${resultBundlePath}"`,
      { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
    );
    
    const testReport = JSON.parse(testReportJson);
    let totalPassed = 0;
    let totalFailed = 0;
    const failingTests: Array<{ identifier: string; reason: string }> = [];
    
    // Parse the legacy test report structure
    if (testReport.tests) {
      const accumulator = { totalPassed: 0, totalFailed: 0, failingTests };
      this.countLegacyTests(testReport.tests, accumulator);
      totalPassed = accumulator.totalPassed;
      totalFailed = accumulator.totalFailed;
    }
    
    return {
      passed: totalPassed,
      failed: totalFailed,
      success: totalFailed === 0,
      failingTests: failingTests.length > 0 ? failingTests : undefined
    };
  }
  
  /**
   * Count tests in legacy format recursively
   */
  private countLegacyTests(
    tests: any[],
    accumulator: { totalPassed: number; totalFailed: number; failingTests: Array<{ identifier: string; reason: string }> }
  ): void {
    for (const test of tests) {
      if (test.subtests) {
        // This is a test suite, recurse into it
        this.countLegacyTests(test.subtests, accumulator);
      } else if (test.testStatus) {
        // This is an actual test
        if (test.testStatus === 'Success') {
          accumulator.totalPassed++;
        } else if (test.testStatus === 'Failure' || test.testStatus === 'Expected Failure') {
          accumulator.totalFailed++;
          // Extract test name and failure details
          if (test.identifier) {
            const failureReason = test.failureMessage || test.message || 'Test failed (no details available)';
            accumulator.failingTests.push({
              identifier: test.identifier,
              reason: failureReason
            });
          }
        }
      }
    }
  }
}