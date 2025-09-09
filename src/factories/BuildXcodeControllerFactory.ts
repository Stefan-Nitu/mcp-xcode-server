import { exec } from 'child_process';
import { promisify } from 'util';
import { BuildXcodeController } from '../presentation/controllers/BuildXcodeController.js';
import { BuildXcodePresenter } from '../presentation/presenters/BuildXcodePresenter.js';
import { BuildProjectUseCase } from '../application/use-cases/BuildProjectUseCase.js';

// Infrastructure adapters
import { BuildDestinationMapperAdapter } from '../infrastructure/adapters/BuildDestinationMapperAdapter.js';
import { XcodeBuildCommandAdapter } from '../infrastructure/adapters/XcodeBuildCommandAdapter.js';
import { ShellCommandExecutorAdapter } from '../infrastructure/adapters/ShellCommandExecutorAdapter.js';
import { BuildArtifactLocatorAdapter } from '../infrastructure/adapters/BuildArtifactLocatorAdapter.js';
import { LogManagerInstance } from '../utils/LogManagerInstance.js';
import { XcbeautifyOutputParserAdapter } from '../infrastructure/adapters/XcbeautifyOutputParserAdapter.js';
import { ConfigProviderAdapter } from '../infrastructure/adapters/ConfigProviderAdapter.js';
import { SystemArchitectureDetector } from '../infrastructure/services/SystemArchitectureDetector.js';

/**
 * Factory class for creating BuildXcodeController with all dependencies
 */
export class BuildXcodeControllerFactory {
  static create(): BuildXcodeController {
    // Create infrastructure adapters
    const execAsync = promisify(exec);
    const executor = new ShellCommandExecutorAdapter(execAsync);
    const systemArchitectureDetector = new SystemArchitectureDetector(executor);
    const destinationMapper = new BuildDestinationMapperAdapter(systemArchitectureDetector);
    const commandBuilder = new XcodeBuildCommandAdapter();
    const appLocator = new BuildArtifactLocatorAdapter(executor);
    const logManager = new LogManagerInstance();
    const outputParser = new XcbeautifyOutputParserAdapter();
    
    // Create use case with infrastructure
    const buildUseCase = new BuildProjectUseCase(
      destinationMapper,
      commandBuilder,
      executor,
      appLocator,
      logManager,
      outputParser
    );
    
    // Create infrastructure services
    const configProvider = new ConfigProviderAdapter();
    
    // Create presenter
    const presenter = new BuildXcodePresenter();

    // Create and return the controller
    return new BuildXcodeController(buildUseCase, presenter, configProvider);
  }
}

/**
 * Factory function to create BuildXcodeController with all dependencies
 * The controller serves as the MCP tool interface
 * 
 * @deprecated Use BuildXcodeControllerFactory.create() instead
 */
export function createBuildXcodeTool(): BuildXcodeController {
  return BuildXcodeControllerFactory.create();
}