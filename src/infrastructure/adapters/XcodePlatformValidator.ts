import { createModuleLogger } from '../../logger.js';
import { Platform } from '../../domain/value-objects/Platform.js';
import { PlatformInfo } from '../../domain/value-objects/PlatformInfo.js';
import { IPlatformValidator } from '../../application/ports/BuildPorts.js';
import { ICommandExecutor } from '../../application/ports/CommandPorts.js';
import { ShellCommandExecutor } from './ShellCommandExecutor.js';

const logger = createModuleLogger('XcodePlatformValidator');

/**
 * Validates platform support for Xcode projects
 * Single Responsibility: Validate that a scheme supports the requested platform
 */
export class XcodePlatformValidator implements IPlatformValidator {
  constructor(private executor: ICommandExecutor = new ShellCommandExecutor()) {}

  /**
   * Validates that a scheme supports the requested platform
   * @throws Error if the platform is not supported
   */
  async validate(
    projectPath: string,
    isWorkspace: boolean,
    scheme: string | undefined,
    platform: Platform
  ): Promise<void> {
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    
    let command = `xcodebuild -showBuildSettings ${projectFlag} "${projectPath}"`;
    
    if (scheme) {
      command += ` -scheme "${scheme}"`;
    }
    
    // Use a generic destination to check platform support
    const platformInfo = PlatformInfo.fromPlatform(platform);
    const destination = platformInfo.generateGenericDestination();
    command += ` -destination '${destination}'`;
    
    logger.debug({ command }, 'Validating platform support');
    
    const result = await this.executor.execute(command, { 
      maxBuffer: 1024 * 1024, // 1MB is enough for validation
      timeout: 10000 // 10 second timeout for validation
    });
    
    if (result.exitCode === 0) {
      logger.debug({ platform, scheme }, 'Platform validation succeeded');
      return;
    }
    
    const output = result.stdout + result.stderr;
    
    // Check if error indicates platform mismatch
    if (output.includes('Available destinations for')) {
      // Extract available platforms from the error message
      const availablePlatforms = this.extractAvailablePlatforms(output);
      throw new Error(
        `Platform '${platform}' is not supported by scheme '${scheme || 'default'}'. ` +
        `Available platforms: ${availablePlatforms.join(', ')}`
      );
    }
    
    // Some other error - let it pass through for now
    logger.warn({ exitCode: result.exitCode }, 'Platform validation check failed, continuing anyway');
  }
  
  /**
   * Extracts available platforms from xcodebuild error output
   */
  private extractAvailablePlatforms(output: string): string[] {
    const platforms = new Set<string>();
    const lines = output.split('\n');
    
    // Find where "Available destinations" section starts
    let inAvailableSection = false;
    
    for (const line of lines) {
      // Start extracting after we find "Available destinations"
      if (line.includes('Available destinations for')) {
        inAvailableSection = true;
        continue;
      }
      
      // Only extract from lines in the available destinations section
      if (inAvailableSection) {
        // Look for lines like "{ platform:watchOS" or "{ platform:iOS Simulator"
        const match = line.match(/\{ platform:([^,}]+)/);
        if (match) {
          let platform = match[1].trim();
          // Normalize platform names
          if (platform.includes('Simulator')) {
            platform = platform.replace(' Simulator', '');
          }
          platforms.add(platform);
        }
      }
    }
    
    return Array.from(platforms);
  }
}