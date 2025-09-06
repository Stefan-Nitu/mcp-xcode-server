import { BuildXcodeTool } from '../tools/BuildXcodeTool.js';
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
 * Factory function to create BuildXcodeTool with all dependencies
 */
export function createBuildXcodeTool(): BuildXcodeTool {
  // Create infrastructure adapters
  const executor = new ShellCommandExecutorAdapter();
  const systemArchitectureDetector = new SystemArchitectureDetector(executor);
  const destinationMapper = new BuildDestinationMapperAdapter(systemArchitectureDetector);
  const commandBuilder = new XcodeBuildCommandAdapter();
  const appLocator = new BuildArtifactLocatorAdapter();
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
  // ConfigProvider is now stateless and project path is passed at runtime
  const configProvider = new ConfigProviderAdapter();
  
  // Create controller with use case and services
  const controller = new BuildXcodeController(buildUseCase, configProvider);
  
  // Create presenter
  const presenter = new BuildXcodePresenter();
  
  // Create and return the tool
  return new BuildXcodeTool(controller, presenter);
}