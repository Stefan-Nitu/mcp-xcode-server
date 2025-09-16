import { SimulatorState } from '../../simulator/domain/SimulatorState.js';
import { InstallRequest } from '../domain/InstallRequest.js';
import { DeviceId } from '../../../shared/domain/DeviceId.js';
import {
  InstallResult,
  InstallCommandFailedError,
  SimulatorNotFoundError,
  NoBootedSimulatorError
} from '../domain/InstallResult.js';
import { 
  ISimulatorLocator,
  ISimulatorControl,
  IAppInstaller 
} from '../../../application/ports/SimulatorPorts.js';
import { ILogManager } from '../../../application/ports/LoggingPorts.js';

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
    // Get app name from the AppPath value object
    const appName = request.appPath.name;

    // Find target simulator
    const simulator = request.simulatorId
      ? await this.simulatorLocator.findSimulator(request.simulatorId.toString())
      : await this.simulatorLocator.findBootedSimulator();
    
    if (!simulator) {
      this.logManager.saveDebugData('install-app-failed', {
        reason: 'simulator_not_found',
        requestedId: request.simulatorId?.toString()
      }, appName);

      const error = request.simulatorId
        ? new SimulatorNotFoundError(request.simulatorId)
        : new NoBootedSimulatorError();
      return InstallResult.failed(error, request.appPath, request.simulatorId);
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
          const installError = new InstallCommandFailedError(error.message || error.toString());
          return InstallResult.failed(
            installError,
            request.appPath,
            DeviceId.create(simulator.id),
            simulator.name
          );
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
      
      // Try to get bundle ID from app (could be enhanced later)
      const bundleId = appName; // For now, use app name as bundle ID
      
      return InstallResult.succeeded(
        bundleId,
        DeviceId.create(simulator.id),
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
      
      const installError = new InstallCommandFailedError(error.message || error.toString());
      return InstallResult.failed(
        installError,
        request.appPath,
        DeviceId.create(simulator.id),
        simulator.name
      );
    }
  }
}