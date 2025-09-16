import { Platform } from '../../../shared/domain/Platform.js';
import { SimulatorState } from './SimulatorState.js';

/**
 * Value object for list simulators request
 */
export class ListSimulatorsRequest {
  constructor(
    public readonly platform?: Platform,
    public readonly state?: SimulatorState,
    public readonly name?: string
  ) {}

  static create(
    platform?: Platform,
    state?: SimulatorState,
    name?: string
  ): ListSimulatorsRequest {
    return new ListSimulatorsRequest(platform, state, name);
  }
}