import { Platform } from '../../../shared/domain/Platform.js';
import { SimulatorState } from './SimulatorState.js';

export interface SimulatorInfo {
  udid: string;
  name: string;
  state: SimulatorState;
  platform: string;
  runtime: string;
}

// Base class for all list simulators errors
export abstract class ListSimulatorsError extends Error {}

// Specific error types
export class SimulatorListParseError extends ListSimulatorsError {
  constructor() {
    super('Failed to parse simulator list: not valid JSON');
    this.name = 'SimulatorListParseError';
  }
}

/**
 * Result of listing simulators operation
 */
export class ListSimulatorsResult {
  private constructor(
    public readonly simulators: SimulatorInfo[],
    public readonly error?: Error
  ) {}

  static success(simulators: SimulatorInfo[]): ListSimulatorsResult {
    return new ListSimulatorsResult(simulators);
  }

  static failed(error: Error): ListSimulatorsResult {
    return new ListSimulatorsResult([], error);
  }

  get isSuccess(): boolean {
    return !this.error;
  }

  get count(): number {
    return this.simulators.length;
  }
}