// No infrastructure imports! Only domain and application layer

// Domain
import { BuildRequest } from '../../domain/value-objects/BuildRequest.js';
import { BuildResult } from '../../domain/entities/BuildResult.js';

// Application ports
import { 
  IPlatformValidator,
  IBuildCommandBuilder,
  ICommandExecutor,
  IAppLocator
} from '../ports/BuildPorts.js';
import { ILogManager } from '../ports/LoggingPorts.js';
import { IConfigProvider } from '../ports/ConfigPorts.js';
import { IOutputParser } from '../ports/OutputParserPorts.js';

/**
 * Use Case: Build an Xcode project
 * Orchestrates the build process using domain logic and infrastructure services
 */
export class BuildProjectUseCase {
  constructor(
    private validator: IPlatformValidator,
    private commandBuilder: IBuildCommandBuilder,
    private executor: ICommandExecutor,
    private appLocator: IAppLocator,
    private logManager: ILogManager,
    private configProvider: IConfigProvider,
    private outputParser: IOutputParser
  ) {}
  
  async execute(request: BuildRequest): Promise<BuildResult> {
    // Request is already validated and created at the border (BuildXcodeTool)
    // Use case just orchestrates business logic
    
    // 3. Validate platform support (business rule)
    await this.validator.validate(
      request.projectPath.toString(),
      request.projectPath.isWorkspace,
      request.scheme,
      request.platform
    );
    
    // 4. Build command
    const command = this.commandBuilder.build(
      request.projectPath.toString(),
      request.projectPath.isWorkspace,
      {
        scheme: request.scheme,
        configuration: request.configuration.configuration,
        platform: request.platform,
        deviceId: request.deviceId,
        derivedDataPath: request.derivedDataPath
      }
    );
    
    // Log via LogManager instead of direct logger
    this.logManager.saveDebugData('build-command', { command }, request.projectPath.name);
    
    // 5. Execute build
    const result = await this.executor.execute(command, {
      maxBuffer: 50 * 1024 * 1024,
      shell: '/bin/bash'
    });
    
    const output = result.stdout + (result.stderr ? `\n${result.stderr}` : '');
    
    // 6. Process result
    if (result.exitCode === 0) {
      // Success path
      const appPath = await this.appLocator.findApp(request.derivedDataPath);
      
      // Log success via LogManager
      this.logManager.saveDebugData('build-success', {
        project: request.projectPath.name,
        scheme: request.scheme,
        configuration: request.configuration.configuration,
        platform: request.platform 
      }, request.projectPath.name);
      
      const logPath = this.logManager.saveLog('build', output, request.projectPath.name, {
        scheme: request.scheme,
        configuration: request.configuration.configuration,
        platform: request.platform,
        exitCode: result.exitCode,
        command
      });
      
      return BuildResult.success(output, appPath, logPath);
    } else {
      // Failure path
      // Log failure via LogManager
      this.logManager.saveDebugData('build-failure', { exitCode: result.exitCode }, request.projectPath.name);
      
      // Use injected output parser
      const parsed = this.outputParser.parseBuildOutput(output);
      
      const logPath = this.logManager.saveLog('build', output, request.projectPath.name, {
        scheme: request.scheme,
        configuration: request.configuration.configuration,
        platform: request.platform,
        exitCode: result.exitCode,
        command,
        errors: parsed.errors,
        warnings: parsed.warnings
      });
      
      if (parsed.errors.length > 0) {
        this.logManager.saveDebugData('build-errors', parsed.errors, request.projectPath.name);
      }
      
      // Create detailed error for throwing
      const error = new Error(this.outputParser.formatOutput(parsed)) as any;
      error.buildResult = BuildResult.failure(output, parsed.errors, result.exitCode, logPath);
      error.parsed = parsed;
      
      throw error;
    }
  }
}