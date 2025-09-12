import { exec } from 'child_process';
import { promisify } from 'util';
import { ShutdownSimulatorUseCase } from '../application/use-cases/ShutdownSimulatorUseCase.js';
import { ShutdownSimulatorController } from '../presentation/controllers/ShutdownSimulatorController.js';
import { SimulatorLocatorAdapter } from '../infrastructure/adapters/SimulatorLocatorAdapter.js';
import { SimulatorControlAdapter } from '../infrastructure/adapters/SimulatorControlAdapter.js';
import { ShellCommandExecutorAdapter } from '../infrastructure/adapters/ShellCommandExecutorAdapter.js';

/**
 * Factory class for creating ShutdownSimulatorController with all dependencies
 * This is the composition root for the shutdown simulator functionality
 */
export class ShutdownSimulatorControllerFactory {
  static create(): ShutdownSimulatorController {
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
    
    // Create and return the controller (which serves as MCP tool)
    return new ShutdownSimulatorController(useCase);
  }
}