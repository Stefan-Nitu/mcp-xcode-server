import { exec } from 'child_process';
import { promisify } from 'util';
import { InstallAppUseCase } from '../application/use-cases/InstallAppUseCase.js';
import { InstallAppController } from '../presentation/controllers/InstallAppController.js';
import { MCPController } from '../presentation/interfaces/MCPController.js';
import { SimulatorLocatorAdapter } from '../infrastructure/adapters/SimulatorLocatorAdapter.js';
import { SimulatorControlAdapter } from '../infrastructure/adapters/SimulatorControlAdapter.js';
import { AppInstallerAdapter } from '../infrastructure/adapters/AppInstallerAdapter.js';
import { ShellCommandExecutorAdapter } from '../infrastructure/adapters/ShellCommandExecutorAdapter.js';
import { LogManagerInstance } from '../utils/LogManagerInstance.js';
import { DependencyCheckingDecorator } from '../presentation/decorators/DependencyCheckingDecorator.js';
import { DependencyChecker } from '../infrastructure/services/DependencyChecker.js';

/**
 * Factory class for creating InstallAppController with all dependencies
 * This is the composition root for the install app functionality
 */
export class InstallAppControllerFactory {
  static create(): MCPController {
    // Create the shell executor that all adapters will use
    const execAsync = promisify(exec);
    const executor = new ShellCommandExecutorAdapter(execAsync);

    // Create infrastructure adapters
    const simulatorLocator = new SimulatorLocatorAdapter(executor);
    const simulatorControl = new SimulatorControlAdapter(executor);
    const appInstaller = new AppInstallerAdapter(executor);
    const logManager = new LogManagerInstance();

    // Create the use case with all dependencies
    const useCase = new InstallAppUseCase(
      simulatorLocator,
      simulatorControl,
      appInstaller,
      logManager
    );

    // Create the controller
    const controller = new InstallAppController(useCase);

    // Create dependency checker
    const dependencyChecker = new DependencyChecker(executor);

    // Wrap with dependency checking decorator
    const decoratedController = new DependencyCheckingDecorator(
      controller,
      ['xcrun'],  // simctl is part of xcrun
      dependencyChecker
    );

    return decoratedController;
  }
}