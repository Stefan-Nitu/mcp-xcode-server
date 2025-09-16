import { Platform } from '../../../shared/domain/Platform.js';
import { SimulatorState } from './SimulatorState.js';

/**
 * Value object for list simulators request
 */
export class ListSimulatorsRequest {
  constructor(
    public readonly platform?: Platform,
    public readonly state?: SimulatorState
  ) {}

  static create(
    platform?: Platform,
    state?: SimulatorState
  ): ListSimulatorsRequest {
    return new ListSimulatorsRequest(platform, state);
  }
}