import { exec } from 'child_process';
import { promisify } from 'util';
import { BuildXcodeController } from '../controllers/BuildXcodeController.js';
import { BuildXcodePresenter } from '../../../presentation/presenters/BuildXcodePresenter.js';
import { BuildProjectUseCase } from '../use-cases/BuildProjectUseCase.js';
import { MCPController } from '../../../presentation/interfaces/MCPController.js';

// Infrastructure adapters
import { BuildDestinationMapperAdapter } from '../infrastructure/BuildDestinationMapperAdapter.js';
import { XcodeBuildCommandAdapter } from '../infrastructure/XcodeBuildCommandAdapter.js';
import { ShellCommandExecutorAdapter } from '../../../shared/infrastructure/ShellCommandExecutorAdapter.js';
import { BuildArtifactLocatorAdapter } from '../infrastructure/BuildArtifactLocatorAdapter.js';
import { LogManagerInstance } from '../../../utils/LogManagerInstance.js';
import { XcbeautifyOutputParserAdapter } from '../infrastructure/XcbeautifyOutputParserAdapter.js';
import { XcbeautifyFormatterAdapter } from '../infrastructure/XcbeautifyFormatterAdapter.js';
import { ConfigProviderAdapter } from '../../../shared/infrastructure/ConfigProviderAdapter.js';

// Decorator and dependency checking
import { DependencyCheckingDecorator } from '../../../presentation/decorators/DependencyCheckingDecorator.js';
import { DependencyChecker } from '../../../infrastructure/services/DependencyChecker.js';

/**
 * Factory class for creating BuildXcodeController with all dependencies
 */
export class BuildXcodeControllerFactory {
  static create(): MCPController {
    // Create infrastructure adapters
    const execAsync = promisify(exec);
    const executor = new ShellCommandExecutorAdapter(execAsync);
    const destinationMapper = new BuildDestinationMapperAdapter();
    const commandBuilder = new XcodeBuildCommandAdapter();
    const appLocator = new BuildArtifactLocatorAdapter(executor);
    const logManager = new LogManagerInstance();
    const outputParser = new XcbeautifyOutputParserAdapter();
    const outputFormatter = new XcbeautifyFormatterAdapter(executor);

    // Create use case with infrastructure
    const buildUseCase = new BuildProjectUseCase(
      destinationMapper,
      commandBuilder,
      executor,
      appLocator,
      logManager,
      outputParser,
      outputFormatter
    );

    // Create infrastructure services
    const configProvider = new ConfigProviderAdapter();

    // Create presenter
    const presenter = new BuildXcodePresenter();

    // Create the controller
    const controller = new BuildXcodeController(buildUseCase, presenter, configProvider);

    // Create dependency checker
    const dependencyChecker = new DependencyChecker(executor);

    // Wrap with dependency checking decorator
    const decoratedController = new DependencyCheckingDecorator(
      controller,
      ['xcodebuild', 'xcbeautify'],
      dependencyChecker
    );

    return decoratedController;
  }
}