/**
 * Domain entity representing the result of a boot simulator operation
 * 
 * Separates user-facing outcome from internal diagnostics
 */

// User-facing outcome (what happened)
export enum BootOutcome {
  Booted = 'booted',              // Successfully booted the simulator
  AlreadyBooted = 'alreadyBooted', // Simulator was already running  
  Failed = 'failed'                // Boot failed
}

// Base class for all boot-related errors
export abstract class BootError extends Error {}

// Specific error types
export class SimulatorNotFoundError extends BootError {
  constructor(public readonly deviceId: string) {
    super(deviceId); // Just store the data
    this.name = 'SimulatorNotFoundError';
  }
}

export class BootCommandFailedError extends BootError {
  constructor(public readonly stderr: string) {
    super(stderr); // Just store the stderr output
    this.name = 'BootCommandFailedError';
  }
}

// Internal diagnostics (why/how it happened)
export interface BootDiagnostics {
  readonly simulatorId: string;
  readonly simulatorName: string;
  readonly error?: BootError;           // Any boot-specific error
  readonly runtime?: string;            // Which iOS version
  readonly platform?: string;           // iOS, tvOS, etc
}

// Complete result combining outcome and diagnostics
export interface BootResult {
  readonly outcome: BootOutcome;
  readonly diagnostics: BootDiagnostics;
}

export const BootResult = {
  /**
   * Simulator was successfully booted
   */
  booted(simulatorId: string, simulatorName: string, diagnostics?: Partial<BootDiagnostics>): BootResult {
    return Object.freeze({
      outcome: BootOutcome.Booted,
      diagnostics: Object.freeze({
        simulatorId,
        simulatorName,
        ...diagnostics
      })
    });
  },

  /**
   * Simulator was already running
   */
  alreadyBooted(simulatorId: string, simulatorName: string, diagnostics?: Partial<BootDiagnostics>): BootResult {
    return Object.freeze({
      outcome: BootOutcome.AlreadyBooted,
      diagnostics: Object.freeze({
        simulatorId,
        simulatorName,
        ...diagnostics
      })
    });
  },

  /**
   * Boot operation failed
   */
  failed(simulatorId: string, simulatorName: string, error: BootError, diagnostics?: Partial<BootDiagnostics>): BootResult {
    return Object.freeze({
      outcome: BootOutcome.Failed,
      diagnostics: Object.freeze({
        simulatorId,
        simulatorName,
        error,
        ...diagnostics
      })
    });
  }
};