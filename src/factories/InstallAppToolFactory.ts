import { exec } from 'child_process';
import { promisify } from 'util';
import { InstallAppUseCase } from '../application/use-cases/InstallAppUseCase.js';
import { SimulatorLocatorAdapter } from '../infrastructure/adapters/SimulatorLocatorAdapter.js';
import { SimulatorStateQueryAdapter } from '../infrastructure/adapters/SimulatorStateQueryAdapter.js';
import { SimulatorControlAdapter } from '../infrastructure/adapters/SimulatorControlAdapter.js';
import { AppInstallerAdapter } from '../infrastructure/adapters/AppInstallerAdapter.js';
import { ShellCommandExecutorAdapter } from '../infrastructure/adapters/ShellCommandExecutorAdapter.js';
import { LogManagerInstance } from '../utils/LogManagerInstance.js';

/**
 * Factory function to create InstallAppUseCase with all dependencies
 * This is the composition root for the install app functionality
 */
export function createInstallAppUseCase(): InstallAppUseCase {
  // Create the shell executor that all adapters will use
  const execAsync = promisify(exec);
  const executor = new ShellCommandExecutorAdapter(execAsync);
  
  // Create infrastructure adapters
  const simulatorLocator = new SimulatorLocatorAdapter(executor);
  const stateQuery = new SimulatorStateQueryAdapter(executor);
  const simulatorControl = new SimulatorControlAdapter(executor);
  const appInstaller = new AppInstallerAdapter(executor);
  const logManager = new LogManagerInstance();
  
  // Create and return the use case with all dependencies
  return new InstallAppUseCase(
    simulatorLocator,
    stateQuery,
    simulatorControl,
    appInstaller,
    logManager
  );
}