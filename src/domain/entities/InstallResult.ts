/**
 * Domain Entity: Represents the result of an app installation
 * 
 * Separates user-facing outcome from internal diagnostics
 */

// User-facing outcome (what happened)
export enum InstallOutcome {
  Succeeded = 'succeeded',
  Failed = 'failed'
}

// Base class for all install-related errors  
export abstract class InstallError extends Error {}

// Specific error types
export class AppNotFoundError extends InstallError {
  constructor(public readonly appPath: string) {
    super(appPath);
    this.name = 'AppNotFoundError';
  }
}

export class SimulatorNotFoundError extends InstallError {
  constructor(public readonly simulatorId: string) {
    super(simulatorId);
    this.name = 'SimulatorNotFoundError';
  }
}

export class InstallCommandFailedError extends InstallError {
  constructor(public readonly stderr: string) {
    super(stderr);
    this.name = 'InstallCommandFailedError';
  }
}

// Internal diagnostics (why/how it happened)
export interface InstallDiagnostics {
  readonly appPath: string;
  readonly simulatorId?: string;
  readonly simulatorName?: string;
  readonly bundleId?: string;
  readonly error?: InstallError;
  readonly installedAt: Date;
}

// Complete result combining outcome and diagnostics
export interface InstallResult {
  readonly outcome: InstallOutcome;
  readonly diagnostics: InstallDiagnostics;
}

export const InstallResult = {
  /**
   * Installation succeeded
   */
  succeeded(
    bundleId: string,
    simulatorId: string,
    simulatorName: string,
    appPath: string,
    diagnostics?: Partial<InstallDiagnostics>
  ): InstallResult {
    return Object.freeze({
      outcome: InstallOutcome.Succeeded,
      diagnostics: Object.freeze({
        bundleId,
        simulatorId,
        simulatorName,
        appPath,
        installedAt: new Date(),
        ...diagnostics
      })
    });
  },

  /**
   * Installation failed
   */
  failed(
    error: InstallError,
    appPath: string,
    simulatorId?: string,
    simulatorName?: string,
    diagnostics?: Partial<InstallDiagnostics>
  ): InstallResult {
    return Object.freeze({
      outcome: InstallOutcome.Failed,
      diagnostics: Object.freeze({
        error,
        appPath,
        simulatorId,
        simulatorName,
        installedAt: new Date(),
        ...diagnostics
      })
    });
  }
};