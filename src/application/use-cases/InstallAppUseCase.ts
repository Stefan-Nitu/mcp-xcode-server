import { AppPath } from '../../domain/value-objects/AppPath.js';
import { SimulatorState } from '../../domain/value-objects/SimulatorState.js';
import { 
  ISimulatorLocator, 
  ISimulatorStateQuery,
  ISimulatorControl,
  IAppInstaller 
} from '../ports/SimulatorPorts.js';
import { ILogManager } from '../ports/LoggingPorts.js';

export interface InstallAppRequest {
  appPath: AppPath;
  simulatorId?: string;
}

export interface InstallAppResult {
  success: boolean;
  message: string;
  simulatorName: string;
  appName: string;
}

/**
 * Use Case: Install an app on a simulator
 * Orchestrates finding the target simulator, booting if needed, and installing the app
 */
export class InstallAppUseCase {
  constructor(
    private simulatorLocator: ISimulatorLocator,
    private stateQuery: ISimulatorStateQuery,
    private simulatorControl: ISimulatorControl,
    private appInstaller: IAppInstaller,
    private logManager: ILogManager
  ) {}

  async execute(request: InstallAppRequest): Promise<InstallAppResult> {
    const appName = request.appPath.name;
    
    // Find target simulator
    const simulator = request.simulatorId
      ? await this.simulatorLocator.findSimulator(request.simulatorId)
      : await this.simulatorLocator.findBootedSimulator();
    
    if (!simulator) {
      const message = request.simulatorId
        ? `Simulator not found: ${request.simulatorId}`
        : 'No booted simulator found. Please boot a simulator first or specify a simulator ID.';
      
      this.logManager.saveDebugData('install-app-failed', {
        reason: 'simulator_not_found',
        requestedId: request.simulatorId
      }, appName);
      
      throw new Error(message);
    }
    
    // Boot simulator if needed (only when specific ID provided)
    if (request.simulatorId) {
      const state = await this.stateQuery.getState(simulator.id);
      if (state === SimulatorState.Shutdown) {
        try {
          await this.simulatorControl.boot(simulator.id);
          this.logManager.saveDebugData('simulator-auto-booted', {
            simulatorId: simulator.id,
            simulatorName: simulator.name
          }, appName);
        } catch (error: any) {
          this.logManager.saveDebugData('simulator-boot-failed', {
            simulatorId: simulator.id,
            error: error.message
          }, appName);
          throw new Error(`Failed to boot simulator: ${error.message}`);
        }
      }
    }
    
    // Install the app
    try {
      await this.appInstaller.installApp(
        request.appPath.toString(),
        simulator.id
      );
      
      this.logManager.saveDebugData('install-app-success', {
        simulator: simulator.name,
        simulatorId: simulator.id,
        app: appName
      }, appName);
      
      return {
        success: true,
        message: `Successfully installed ${appName} on ${simulator.name}`,
        simulatorName: simulator.name,
        appName: appName
      };
    } catch (error: any) {
      this.logManager.saveDebugData('install-app-error', {
        simulator: simulator.name,
        simulatorId: simulator.id,
        app: appName,
        error: error.message
      }, appName);
      
      throw new Error(`Failed to install app: ${error.message}`);
    }
  }
}