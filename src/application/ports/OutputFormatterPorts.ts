/**
 * Port for formatting build output
 * This allows us to swap between different formatters (xcbeautify, raw, custom)
 */
export interface IOutputFormatter {
  /**
   * Format raw build output into a more readable format
   * @param rawOutput The raw output from xcodebuild
   * @returns Formatted output
   */
  format(rawOutput: string): Promise<string>;
}