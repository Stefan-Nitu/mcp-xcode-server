import { createModuleLogger } from '../../../logger.js';
import { Platform } from '../../../types.js';
import { config } from '../../../config.js';
import path from 'path';
import { parseXcbeautifyOutput, formatParsedOutput } from '../../errors/xcbeautify-parser.js';

// Interfaces
import { 
  IPlatformValidator, 
  IBuildCommandBuilder, 
  ICommandExecutor, 
  IAppLocator 
} from './interfaces.js';
import { ILogManager } from './ILogManager.js';

// Default implementations
import { PlatformValidator } from './PlatformValidator.js';
import { BuildCommandBuilder, BuildOptions } from './BuildCommandBuilder.js';
import { CommandExecutor } from './CommandExecutor.js';
import { AppLocator } from './AppLocator.js';
import { LogManagerInstance } from '../../LogManagerInstance.js';

const logger = createModuleLogger('XcodeBuild');

/**
 * Handles xcodebuild build operations
 * Single Responsibility: Execute and manage build operations
 */
export class XcodeBuild {
  constructor(
    private validator: IPlatformValidator = new PlatformValidator(),
    private commandBuilder: IBuildCommandBuilder = new BuildCommandBuilder(),
    private executor: ICommandExecutor = new CommandExecutor(),
    private appLocator: IAppLocator = new AppLocator(),
    private logManager: ILogManager = new LogManagerInstance()
  ) {}
  
  /**
   * Build an Xcode project or workspace
   */
  async build(
    projectPath: string,
    isWorkspace: boolean,
    options: BuildOptions = {}
  ): Promise<{ success: boolean; output: string; appPath?: string; logPath?: string; errors?: any[] }> {
    const {
      scheme,
      configuration = 'Debug',
      platform = Platform.iOS,
      derivedDataPath = config.getDerivedDataPath(projectPath)
    } = options;
    
    // Validate platform support
    await this.validator.validate(projectPath, isWorkspace, scheme, platform);
    
    // Build command
    const command = this.commandBuilder.build(projectPath, isWorkspace, {
      ...options,
      derivedDataPath
    });
    
    logger.debug({ command }, 'Build command');
    
    // Execute build
    const result = await this.executor.execute(command, {
      maxBuffer: 50 * 1024 * 1024,
      shell: '/bin/bash'
    });
    
    const output = result.stdout + (result.stderr ? `\n${result.stderr}` : '');
    const projectName = path.basename(projectPath, path.extname(projectPath));
    
    if (result.exitCode === 0) {
      // Build succeeded
      const appPath = await this.appLocator.findApp(derivedDataPath);
      
      logger.info({ projectPath, scheme, configuration, platform }, 'Build succeeded');
      
      // Save log
      const logPath = this.logManager.saveLog('build', output, projectName, {
        scheme,
        configuration,
        platform,
        exitCode: result.exitCode,
        command
      });
      
      return {
        success: true,
        output,
        appPath,
        logPath
      };
    } else {
      // Build failed
      logger.error({ exitCode: result.exitCode, projectPath }, 'Build failed');
      
      // Parse errors using xcbeautify parser
      const parsed = parseXcbeautifyOutput(output);
      
      // Save log with errors
      const logPath = this.logManager.saveLog('build', output, projectName, {
        scheme,
        configuration,
        platform,
        exitCode: result.exitCode,
        command,
        errors: parsed.errors,
        warnings: parsed.warnings
      });
      
      if (parsed.errors.length > 0) {
        this.logManager.saveDebugData('build-errors', parsed.errors, projectName);
      }
      
      // Create error with parsed details
      const errorWithDetails = new Error(formatParsedOutput(parsed)) as any;
      errorWithDetails.output = output;
      errorWithDetails.parsed = parsed;
      errorWithDetails.logPath = logPath;
      
      throw errorWithDetails;
    }
  }
}

// Re-export BuildOptions for backward compatibility
export { BuildOptions };