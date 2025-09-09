// No infrastructure imports! Only domain and application layer

// Domain
import { BuildRequest } from '../../domain/value-objects/BuildRequest.js';
import { BuildResult } from '../../domain/entities/BuildResult.js';

// Application ports
import { IBuildCommand } from '../ports/BuildPorts.js';
import { ICommandExecutor } from '../ports/CommandPorts.js';
import { IAppLocator } from '../ports/ArtifactPorts.js';
import { ILogManager } from '../ports/LoggingPorts.js';
import { IOutputParser } from '../ports/OutputParserPorts.js';
import { IBuildDestinationMapper } from '../ports/MappingPorts.js';

/**
 * Use Case: Build an Xcode project
 * Orchestrates the build process using domain logic and infrastructure services
 */
export class BuildProjectUseCase {
  constructor(
    private destinationMapper: IBuildDestinationMapper,
    private commandBuilder: IBuildCommand,
    private executor: ICommandExecutor,
    private appLocator: IAppLocator,
    private logManager: ILogManager,
    private outputParser: IOutputParser
  ) {}
  
  async execute(request: BuildRequest): Promise<BuildResult> {
    // Request is already validated and created at the border (BuildXcodeTool)
    // Use case just orchestrates business logic
    
    // 3. Map domain destination to infrastructure format
    const mappedDestination = await this.destinationMapper.toXcodeBuildOptions(
      request.destination
    );
    
    // 4. Build command with already-mapped values
    const command = this.commandBuilder.build(
      request.projectPath.toString(),
      request.projectPath.isWorkspace,
      {
        scheme: request.scheme,
        configuration: request.configuration,
        destination: mappedDestination.destination,
        additionalSettings: mappedDestination.additionalSettings,
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
      
      // Parse output to extract any warnings even for successful builds
      const parsed = this.outputParser.parseBuildOutput(output);
      const warnings = parsed.issues.filter(issue => issue.isWarning());
      
      // Log success via LogManager
      this.logManager.saveDebugData('build-success', {
        project: request.projectPath.name,
        scheme: request.scheme,
        configuration: request.configuration,
        destination: request.destination,
        warningCount: warnings.length
      }, request.projectPath.name);
      
      const logPath = this.logManager.saveLog('build', output, request.projectPath.name, {
        scheme: request.scheme,
        configuration: request.configuration,
        destination: request.destination,
        exitCode: result.exitCode,
        command
      });
      
      return BuildResult.success(output, appPath, logPath, warnings);
    } else {
      // Failure path
      // Log failure via LogManager
      this.logManager.saveDebugData('build-failure', { exitCode: result.exitCode }, request.projectPath.name);
      
      // Use injected output parser
      const parsed = this.outputParser.parseBuildOutput(output);
      
      const logPath = this.logManager.saveLog('build', output, request.projectPath.name, {
        scheme: request.scheme,
        configuration: request.configuration,
        destination: request.destination,
        exitCode: result.exitCode,
        command,
        issues: parsed.issues
      });
      
      // Extract errors from issues for logging
      const errors = parsed.issues.filter(issue => issue.isError());
      if (errors.length > 0) {
        this.logManager.saveDebugData('build-errors', errors, request.projectPath.name);
      }
      
      // Return failure result
      return BuildResult.failure(output, parsed.issues, result.exitCode, logPath);
    }
  }
}