/**
 * Simulator state enum
 * Values match xcrun simctl output exactly for direct comparison
 */
export enum SimulatorState {
  Booted = 'Booted',
  Shutdown = 'Shutdown',
  Unknown = 'Unknown'
}