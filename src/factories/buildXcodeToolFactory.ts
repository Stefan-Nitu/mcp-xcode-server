import { BuildXcodeTool } from '../tools/BuildXcodeTool.js';
import { BuildXcodeController } from '../presentation/controllers/BuildXcodeController.js';
import { BuildXcodePresenter } from '../presentation/presenters/BuildXcodePresenter.js';
import { BuildProjectUseCase } from '../../application/use-cases/BuildProjectUseCase.js';
import { DeviceManager } from '../../application/services/DeviceManager.js';

// Infrastructure adapters
import { XcodePlatformValidator } from '../../infrastructure/adapters/XcodePlatformValidator.js';
import { XcodeBuildCommandBuilder } from '../../infrastructure/adapters/XcodeBuildCommandBuilder.js';
import { ShellCommandExecutor } from '../../infrastructure/adapters/ShellCommandExecutor.js';
import { BuildArtifactLocator } from '../../infrastructure/adapters/BuildArtifactLocator.js';
import { LogManagerInstance } from '../../utils/LogManagerInstance.js';
import { XcbeautifyOutputParser } from '../../infrastructure/adapters/XcbeautifyOutputParser.js';

/**
 * Factory function to create BuildXcodeTool with all dependencies
 */
export function createBuildXcodeTool(): BuildXcodeTool {
  // Create infrastructure adapters
  const validator = new XcodePlatformValidator();
  const commandBuilder = new XcodeBuildCommandBuilder();
  const executor = new ShellCommandExecutor();
  const appLocator = new BuildArtifactLocator();
  const logManager = new LogManagerInstance();
  const outputParser = new XcbeautifyOutputParser();
  
  // Create use case with infrastructure
  const buildUseCase = new BuildProjectUseCase(
    validator,
    commandBuilder,
    executor,
    appLocator,
    logManager,
    outputParser
  );
  
  // Create application services
  const deviceManager = new DeviceManager();
  
  // Create controller with use case and services
  const controller = new BuildXcodeController(buildUseCase, deviceManager);
  
  // Create presenter
  const presenter = new BuildXcodePresenter();
  
  // Create and return the tool
  return new BuildXcodeTool(controller, presenter);
}