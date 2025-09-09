import { SimulatorState } from '../../domain/value-objects/SimulatorState.js';

/**
 * Port interfaces for simulator operations
 * 
 * Focused, single-responsibility interfaces following ISP
 */

export interface ISimulatorLocator {
  /**
   * Find a simulator by ID or name
   * Returns null if not found
   */
  findSimulator(idOrName: string): Promise<SimulatorInfo | null>;
  
  /**
   * Find first booted simulator
   * Returns null if none are booted
   * If multiple are booted, returns one (implementation-defined which)
   */
  findBootedSimulator(): Promise<SimulatorInfo | null>;
}

export interface ISimulatorStateQuery {
  /**
   * Get current state of a simulator
   */
  getState(simulatorId: string): Promise<SimulatorState>;
}

export interface ISimulatorControl {
  /**
   * Boot a simulator
   */
  boot(simulatorId: string): Promise<void>;
  
  /**
   * Shutdown a simulator
   */
  shutdown(simulatorId: string): Promise<void>;
}

export interface IAppInstaller {
  /**
   * Install an app bundle on a specific simulator
   * Throws if installation fails
   */
  installApp(appPath: string, simulatorId: string): Promise<void>;
}

/**
 * Simulator information snapshot
 * Includes current state at time of query (not cached)
 */
export interface SimulatorInfo {
  readonly id: string;
  readonly name: string;
  readonly state: SimulatorState;
  readonly platform: string;
  readonly runtime: string;
}