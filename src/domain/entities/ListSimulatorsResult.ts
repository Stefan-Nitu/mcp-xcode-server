import { Platform } from '../value-objects/Platform.js';
import { SimulatorState } from '../value-objects/SimulatorState.js';

export interface SimulatorInfo {
  udid: string;
  name: string;
  state: SimulatorState;
  platform: string;
  runtime: string;
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