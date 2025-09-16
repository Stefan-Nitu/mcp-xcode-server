import { BuildIssue } from './BuildIssue.js';

/**
 * Domain Entity: Represents the result of a build operation
 * 
 * Separates user-facing outcome from internal diagnostics
 */

// User-facing outcome (what happened)
export enum BuildOutcome {
  Succeeded = 'succeeded',
  Failed = 'failed'
}

// Base class for all build-related errors
export abstract class BuildError extends Error {}

// Specific error types
export class BuildCommandFailedError extends BuildError {
  constructor(
    public readonly stderr: string,
    public readonly exitCode: number
  ) {
    super(stderr);
    this.name = 'BuildCommandFailedError';
  }
}

export class BuildConfigurationError extends BuildError {
  constructor(message: string) {
    super(message);
    this.name = 'BuildConfigurationError';
  }
}

export class OutputFormatterError extends BuildError {
  constructor(
    public readonly stderr: string
  ) {
    super('OutputFormatterError');
    this.name = 'OutputFormatterError';
  }
}

// Internal diagnostics (why/how it happened)
export interface BuildDiagnostics {
  readonly appPath?: string;
  readonly logPath?: string;
  readonly issues: BuildIssue[];
  readonly exitCode: number;
  readonly error?: BuildError;
  readonly scheme?: string;
  readonly configuration?: string;
  readonly platform?: string;
}

// Complete result combining outcome and diagnostics
export interface BuildResult {
  readonly outcome: BuildOutcome;
  readonly diagnostics: BuildDiagnostics;
}

export const BuildResult = {
  /**
   * Build succeeded
   */
  succeeded(
    appPath?: string,
    logPath?: string,
    warnings: BuildIssue[] = [],
    diagnostics?: Partial<BuildDiagnostics>
  ): BuildResult {
    return Object.freeze({
      outcome: BuildOutcome.Succeeded,
      diagnostics: Object.freeze({
        appPath,
        logPath,
        issues: warnings,
        exitCode: 0,
        ...diagnostics
      })
    });
  },

  /**
   * Build failed
   */
  failed(
    issues: BuildIssue[],
    exitCode: number,
    logPath?: string,
    error?: BuildError,
    diagnostics?: Partial<BuildDiagnostics>
  ): BuildResult {
    return Object.freeze({
      outcome: BuildOutcome.Failed,
      diagnostics: Object.freeze({
        issues,
        exitCode,
        logPath,
        error,
        ...diagnostics
      })
    });
  },

  // Helper methods
  hasErrors(result: BuildResult): boolean {
    return result.diagnostics.issues.some(issue => issue.isError());
  },

  getErrors(result: BuildResult): BuildIssue[] {
    return result.diagnostics.issues.filter(issue => issue.isError());
  },

  getWarnings(result: BuildResult): BuildIssue[] {
    return result.diagnostics.issues.filter(issue => issue.isWarning());
  }
};