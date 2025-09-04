import { BuildXcodeTool } from '../tools/BuildXcodeTool.js';
import { BuildXcodeController } from '../presentation/controllers/BuildXcodeController.js';
import { BuildXcodePresenter } from '../presentation/presenters/BuildXcodePresenter.js';
import { BuildProjectUseCase } from '../application/use-cases/BuildProjectUseCase.js';

// Infrastructure adapters
import { BuildDestinationMapper } from '../infrastructure/adapters/BuildDestinationMapper.js';
import { XcodeBuildCommandBuilder } from '../infrastructure/adapters/XcodeBuildCommandBuilder.js';
import { ShellCommandExecutor } from '../infrastructure/adapters/ShellCommandExecutor.js';
import { BuildArtifactLocator } from '../infrastructure/adapters/BuildArtifactLocator.js';
import { LogManagerInstance } from '../utils/LogManagerInstance.js';
import { XcbeautifyOutputParser } from '../infrastructure/adapters/XcbeautifyOutputParser.js';
import { ConfigProvider } from '../infrastructure/adapters/ConfigProvider.js';
import { SystemArchitectureDetector } from '../infrastructure/adapters/SystemArchitectureDetector.js';

/**
 * Factory function to create BuildXcodeTool with all dependencies
 */
export function createBuildXcodeTool(): BuildXcodeTool {
  // Create infrastructure adapters
  const executor = new ShellCommandExecutor();
  const systemArchitectureDetector = new SystemArchitectureDetector(executor);
  const destinationMapper = new BuildDestinationMapper(systemArchitectureDetector);
  const commandBuilder = new XcodeBuildCommandBuilder();
  const appLocator = new BuildArtifactLocator();
  const logManager = new LogManagerInstance();
  const outputParser = new XcbeautifyOutputParser();
  
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
  const configProvider = new ConfigProvider();
  
  // Create controller with use case and services
  const controller = new BuildXcodeController(buildUseCase, configProvider);
  
  // Create presenter
  const presenter = new BuildXcodePresenter();
  
  // Create and return the tool
  return new BuildXcodeTool(controller, presenter);
}