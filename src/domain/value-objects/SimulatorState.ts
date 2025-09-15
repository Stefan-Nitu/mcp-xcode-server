/**
 * Simulator state enum
 * Values match xcrun simctl output exactly for direct comparison
 */
export enum SimulatorState {
  Booted = 'Booted',
  Booting = 'Booting',
  Shutdown = 'Shutdown',
  ShuttingDown = 'Shutting Down'
}

/**
 * SimulatorState validation and parsing utilities
 */
export namespace SimulatorState {
  /**
   * Parse a string into a SimulatorState enum value
   * @throws Error if the string is not a valid state
   */
  export function parse(value: unknown): SimulatorState {
    // Type check
    if (typeof value !== 'string') {
      throw new InvalidTypeError(value);
    }

    // Check if valid state - filter out namespace functions
    const validStates = Object.values(SimulatorState).filter(v => typeof v === 'string') as string[];
    if (!validStates.includes(value)) {
      throw new InvalidStateError(value, validStates);
    }

    return value as SimulatorState;
  }

  /**
   * Parse a string into a SimulatorState enum value or return undefined
   */
  export function parseOptional(value: unknown): SimulatorState | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return parse(value);
  }

  // Error classes
  export class InvalidTypeError extends Error {
    constructor(public readonly providedValue: unknown) {
      const validValues = Object.values(SimulatorState).filter(v => typeof v === 'string') as string[];
      super(`Simulator state must be a string (one of: ${validValues.join(', ')}), got ${typeof providedValue}`);
      this.name = 'SimulatorState.InvalidTypeError';
    }
  }

  export class InvalidStateError extends Error {
    constructor(
      public readonly providedValue: unknown,
      public readonly validValues: string[]
    ) {
      super(`Invalid simulator state: ${providedValue}. Valid values are: ${validValues.join(', ')}`);
      this.name = 'SimulatorState.InvalidStateError';
    }
  }
}