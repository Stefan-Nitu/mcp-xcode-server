import { ListSimulatorsController } from '../presentation/controllers/ListSimulatorsController.js';
import { ListSimulatorsUseCase } from '../application/use-cases/ListSimulatorsUseCase.js';
import { DeviceRepository } from '../infrastructure/repositories/DeviceRepository.js';
import { ShellCommandExecutorAdapter } from '../infrastructure/adapters/ShellCommandExecutorAdapter.js';
import { exec } from 'child_process';
import { promisify } from 'util';

/**
 * Factory for creating ListSimulatorsController with all dependencies
 */
export class ListSimulatorsControllerFactory {
  static create(): ListSimulatorsController {
    const execAsync = promisify(exec);
    const executor = new ShellCommandExecutorAdapter(execAsync);
    const deviceRepository = new DeviceRepository(executor);
    const useCase = new ListSimulatorsUseCase(deviceRepository);

    return new ListSimulatorsController(useCase);
  }
}