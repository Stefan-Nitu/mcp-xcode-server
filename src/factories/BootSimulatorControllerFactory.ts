import { exec } from 'child_process';
import { promisify } from 'util';
import { BootSimulatorUseCase } from '../application/use-cases/BootSimulatorUseCase.js';
import { BootSimulatorController } from '../presentation/controllers/BootSimulatorController.js';
import { MCPController } from '../presentation/interfaces/MCPController.js';
import { SimulatorLocatorAdapter } from '../infrastructure/adapters/SimulatorLocatorAdapter.js';
import { SimulatorControlAdapter } from '../infrastructure/adapters/SimulatorControlAdapter.js';
import { ShellCommandExecutorAdapter } from '../infrastructure/adapters/ShellCommandExecutorAdapter.js';
import { DependencyCheckingDecorator } from '../presentation/decorators/DependencyCheckingDecorator.js';
import { DependencyChecker } from '../infrastructure/services/DependencyChecker.js';

/**
 * Factory class for creating BootSimulatorController with all dependencies
 * This is the composition root for the boot simulator functionality
 */
export class BootSimulatorControllerFactory {
  static create(): MCPController {
    // Create the shell executor that all adapters will use
    const execAsync = promisify(exec);
    const executor = new ShellCommandExecutorAdapter(execAsync);

    // Create infrastructure adapters
    const simulatorLocator = new SimulatorLocatorAdapter(executor);
    const simulatorControl = new SimulatorControlAdapter(executor);

    // Create the use case with all dependencies
    const useCase = new BootSimulatorUseCase(
      simulatorLocator,
      simulatorControl
    );

    // Create the controller
    const controller = new BootSimulatorController(useCase);

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