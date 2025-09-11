import { exec } from 'child_process';
import { promisify } from 'util';
import { BootSimulatorUseCase } from '../application/use-cases/BootSimulatorUseCase.js';
import { BootSimulatorController } from '../presentation/controllers/BootSimulatorController.js';
import { SimulatorLocatorAdapter } from '../infrastructure/adapters/SimulatorLocatorAdapter.js';
import { SimulatorControlAdapter } from '../infrastructure/adapters/SimulatorControlAdapter.js';
import { ShellCommandExecutorAdapter } from '../infrastructure/adapters/ShellCommandExecutorAdapter.js';

/**
 * Factory class for creating BootSimulatorController with all dependencies
 * This is the composition root for the boot simulator functionality
 */
export class BootSimulatorControllerFactory {
  static create(): BootSimulatorController {
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
    
    // Create and return the controller (which serves as MCP tool)
    return new BootSimulatorController(useCase);
  }
}