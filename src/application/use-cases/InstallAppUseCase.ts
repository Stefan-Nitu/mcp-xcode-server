import { AppPath } from '../../domain/value-objects/AppPath.js';
import { SimulatorState } from '../../domain/value-objects/SimulatorState.js';
import { InstallRequest } from '../../domain/value-objects/InstallRequest.js';
import { InstallResult } from '../../domain/entities/InstallResult.js';
import { 
  ISimulatorLocator,
  ISimulatorControl,
  IAppInstaller 
} from '../ports/SimulatorPorts.js';
import { ILogManager } from '../ports/LoggingPorts.js';

/**
 * Use Case: Install an app on a simulator
 * Orchestrates finding the target simulator, booting if needed, and installing the app
 */
export class InstallAppUseCase {
  constructor(
    private simulatorLocator: ISimulatorLocator,
    private simulatorControl: ISimulatorControl,
    private appInstaller: IAppInstaller,
    private logManager: ILogManager
  ) {}

  async execute(request: InstallRequest): Promise<InstallResult> {
    // Create AppPath from the string path in request
    const appPath = AppPath.create(request.appPath);
    const appName = appPath.name;
    
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
      
      return InstallResult.failure(message, request.appPath, request.simulatorId);
    }
    
    // Boot simulator if needed (only when specific ID provided)
    if (request.simulatorId) {
      if (simulator.state === SimulatorState.Shutdown) {
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
          return InstallResult.failure(
            `Failed to boot simulator: ${error.message}`,
            request.appPath,
            simulator.id,
            simulator.name
          );
        }
      }
    }
    
    // Install the app
    try {
      await this.appInstaller.installApp(
        appPath.toString(),
        simulator.id
      );
      
      this.logManager.saveDebugData('install-app-success', {
        simulator: simulator.name,
        simulatorId: simulator.id,
        app: appName
      }, appName);
      
      // Try to get bundle ID from app (could be enhanced later)
      const bundleId = appName; // For now, use app name as bundle ID
      
      return InstallResult.success(
        bundleId,
        simulator.id,
        simulator.name,
        request.appPath
      );
    } catch (error: any) {
      this.logManager.saveDebugData('install-app-error', {
        simulator: simulator.name,
        simulatorId: simulator.id,
        app: appName,
        error: error.message
      }, appName);
      
      return InstallResult.failure(
        `Failed to install app: ${error.message}`,
        request.appPath,
        simulator.id,
        simulator.name
      );
    }
  }
}