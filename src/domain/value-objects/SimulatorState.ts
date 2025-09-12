/**
 * Simulator state enum
 * Values match xcrun simctl output exactly for direct comparison
 */
export enum SimulatorState {
  Booted = 'Booted',
  Booting = 'Booting',
  Shutdown = 'Shutdown',
  ShuttingDown = 'Shutting Down',
  Unknown = 'Unknown'
}