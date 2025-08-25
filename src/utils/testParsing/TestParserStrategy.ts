/**
 * Test result structure returned by all parsing strategies
 */
export interface TestResult {
  success: boolean;
  passed: number;
  failed: number;
  failingTests?: string[];
}

/**
 * Strategy interface for parsing test output from different test frameworks
 */
export interface TestParserStrategy {
  /**
   * Check if this strategy can parse the given output
   * @param output The test output to check
   * @returns true if this strategy can parse the output
   */
  canParse(output: string): boolean;
  
  /**
   * Parse the test output and extract results
   * @param output The test output to parse
   * @returns Parsed test results
   */
  parse(output: string): TestResult;
}