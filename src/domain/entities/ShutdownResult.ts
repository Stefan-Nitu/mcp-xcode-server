/**
 * Domain entity representing the result of a shutdown operation
 */

// Error types specific to shutdown operations
export abstract class ShutdownError extends Error {}

export class SimulatorNotFoundError extends ShutdownError {
  constructor(public readonly deviceId: string) {
    super(deviceId);
    this.name = 'SimulatorNotFoundError';
  }
}

export class ShutdownCommandFailedError extends ShutdownError {
  constructor(public readonly stderr: string) {
    super(stderr);
    this.name = 'ShutdownCommandFailedError';
  }
}

// Possible outcomes of a shutdown operation
export enum ShutdownOutcome {
  Shutdown = 'shutdown',
  AlreadyShutdown = 'already_shutdown',
  Failed = 'failed'
}

// Diagnostics information about the shutdown operation
interface ShutdownDiagnostics {
  simulatorId?: string;
  simulatorName?: string;
  error?: Error;
}

export class ShutdownResult {
  private constructor(
    public readonly outcome: ShutdownOutcome,
    public readonly diagnostics: ShutdownDiagnostics
  ) {}
  
  static shutdown(simulatorId: string, simulatorName: string): ShutdownResult {
    return new ShutdownResult(
      ShutdownOutcome.Shutdown,
      { simulatorId, simulatorName }
    );
  }
  
  static alreadyShutdown(simulatorId: string, simulatorName: string): ShutdownResult {
    return new ShutdownResult(
      ShutdownOutcome.AlreadyShutdown,
      { simulatorId, simulatorName }
    );
  }
  
  static failed(simulatorId: string | undefined, simulatorName: string | undefined, error: Error): ShutdownResult {
    return new ShutdownResult(
      ShutdownOutcome.Failed,
      { simulatorId, simulatorName, error }
    );
  }
}