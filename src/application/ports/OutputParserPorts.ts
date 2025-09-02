import { BuildIssue } from '../../domain/value-objects/BuildIssue.js';

/**
 * Port interface for parsing build output
 * This is an application-level abstraction
 */

export interface ParsedOutput {
  issues: BuildIssue[];
}

export interface IOutputParser {
  /**
   * Parse build output and extract issues (errors/warnings)
   * Only parses - no formatting or adding messages
   */
  parseBuildOutput(output: string): ParsedOutput;
}