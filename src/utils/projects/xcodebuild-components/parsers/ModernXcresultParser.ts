import { execSync } from 'child_process';
import { createModuleLogger } from '../../../../logger.js';
import { TestResult } from '../TestResultParser.js';

const logger = createModuleLogger('ModernXcresultParser');

/**
 * Parser for modern xcresult format (Xcode 16+)
 * Single Responsibility: Parse test results using modern xcresulttool commands
 */
export class ModernXcresultParser {
  /**
   * Parse test results using modern xcresulttool format
   */
  async parse(resultBundlePath: string): Promise<TestResult> {
    let totalPassed = 0;
    let totalFailed = 0;
    const failingTests: Array<{ identifier: string; reason: string }> = [];
    
    // Get summary first
    const summaryJson = execSync(
      `xcrun xcresulttool get test-results summary --path "${resultBundlePath}"`,
      { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
    );
    
    const summary = JSON.parse(summaryJson);
    logger.debug({ summary: { passedTests: summary.passedTests, failedTests: summary.failedTests } }, 'Got summary from xcresulttool');
    
    // Get detailed test results
    try {
      const testsJson = execSync(
        `xcrun xcresulttool get test-results tests --path "${resultBundlePath}"`,
        { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
      );
      const testsData = JSON.parse(testsJson);
      
      // Process test nodes to count tests and extract failing tests
      if (testsData.testNodes && Array.isArray(testsData.testNodes)) {
        const accumulator = { totalPassed: 0, totalFailed: 0, failingTests };
        for (const testNode of testsData.testNodes) {
          this.processTestNodes(testNode, '', accumulator);
        }
        totalPassed = accumulator.totalPassed;
        totalFailed = accumulator.totalFailed;
      }
    } catch (detailsError: any) {
      logger.debug({ error: detailsError.message }, 'Could not extract failing test details');
      // Fall back to summary counts
      totalPassed = summary.passedTests || 0;
      totalFailed = summary.failedTests || 0;
    }
    
    return {
      passed: totalPassed,
      failed: totalFailed,
      success: totalFailed === 0,
      failingTests: failingTests.length > 0 ? failingTests : undefined
    };
  }
  
  /**
   * Process test nodes recursively
   */
  private processTestNodes(
    node: any, 
    parentName: string,
    accumulator: { totalPassed: number; totalFailed: number; failingTests: Array<{ identifier: string; reason: string }> }
  ): void {
    if (!node) return;
    
    // Count test cases (including argument variations)
    if (node.nodeType === 'Test Case') {
      // Check if this test has argument variations
      let hasArguments = false;
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          if (child.nodeType === 'Arguments') {
            hasArguments = true;
            // Each argument variation is a separate test
            if (child.result === 'Passed') {
              accumulator.totalPassed++;
            } else if (child.result === 'Failed') {
              accumulator.totalFailed++;
            }
          }
        }
      }
      
      // If no arguments, count the test case itself
      if (!hasArguments) {
        if (node.result === 'Passed') {
          accumulator.totalPassed++;
        } else if (node.result === 'Failed') {
          accumulator.totalFailed++;
          
          // Extract failure information
          let testName = node.nodeIdentifier || node.name || parentName;
          let failureReason = '';
          
          // Look for failure message in children
          if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
              if (child.nodeType === 'Failure Message') {
                failureReason = child.details || child.name || 'Test failed';
                break;
              }
            }
          }
          
          accumulator.failingTests.push({
            identifier: testName,
            reason: failureReason || 'Test failed (no details available)'
          });
        }
      }
    }
    
    // Recurse through children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this.processTestNodes(child, node.name || parentName, accumulator);
      }
    }
  }
}