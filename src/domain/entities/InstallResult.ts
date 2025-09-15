import { AppPath } from '../value-objects/AppPath.js';
import { DeviceId } from '../value-objects/DeviceId.js';

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
  constructor(public readonly appPath: AppPath) {
    super(appPath.toString());
    this.name = 'AppNotFoundError';
  }
}

export class SimulatorNotFoundError extends InstallError {
  constructor(public readonly simulatorId: DeviceId) {
    super(simulatorId.toString());
    this.name = 'SimulatorNotFoundError';
  }
}

export class NoBootedSimulatorError extends InstallError {
  constructor() {
    super('No booted simulator found');
    this.name = 'NoBootedSimulatorError';
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
  readonly appPath: AppPath;
  readonly simulatorId?: DeviceId;
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
    simulatorId: DeviceId,
    simulatorName: string,
    appPath: AppPath,
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
    appPath: AppPath,
    simulatorId?: DeviceId,
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