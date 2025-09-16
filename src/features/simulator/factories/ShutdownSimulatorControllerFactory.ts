import { exec } from 'child_process';
import { promisify } from 'util';
import { ShutdownSimulatorUseCase } from '../use-cases/ShutdownSimulatorUseCase.js';
import { ShutdownSimulatorController } from '../controllers/ShutdownSimulatorController.js';
import { MCPController } from '../../../presentation/interfaces/MCPController.js';
import { SimulatorLocatorAdapter } from '../infrastructure/SimulatorLocatorAdapter.js';
import { SimulatorControlAdapter } from '../infrastructure/SimulatorControlAdapter.js';
import { ShellCommandExecutorAdapter } from '../../../shared/infrastructure/ShellCommandExecutorAdapter.js';
import { DependencyCheckingDecorator } from '../../../presentation/decorators/DependencyCheckingDecorator.js';
import { DependencyChecker } from '../../../infrastructure/services/DependencyChecker.js';

/**
 * Factory class for creating ShutdownSimulatorController with all dependencies
 * This is the composition root for the shutdown simulator functionality
 */
export class ShutdownSimulatorControllerFactory {
  static create(): MCPController {
    // Create the shell executor that all adapters will use
    const execAsync = promisify(exec);
    const executor = new ShellCommandExecutorAdapter(execAsync);

    // Create infrastructure adapters
    const simulatorLocator = new SimulatorLocatorAdapter(executor);
    const simulatorControl = new SimulatorControlAdapter(executor);

    // Create the use case with all dependencies
    const useCase = new ShutdownSimulatorUseCase(
      simulatorLocator,
      simulatorControl
    );

    // Create the controller
    const controller = new ShutdownSimulatorController(useCase);

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