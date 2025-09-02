import { createModuleLogger } from '../../../logger.js';
import { Platform } from '../../../types.js';
import { PlatformHandler } from '../../../platformHandler.js';
import { ICommandExecutor, IPlatformValidator } from './interfaces.js';
import { CommandExecutor } from './CommandExecutor.js';

const logger = createModuleLogger('PlatformValidator');

/**
 * Validates platform support for Xcode projects
 * Single Responsibility: Validate that a scheme supports the requested platform
 */
export class PlatformValidator implements IPlatformValidator {
  constructor(private executor: ICommandExecutor = new CommandExecutor()) {}

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
    const destination = PlatformHandler.getGenericDestination(platform);
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
    
    for (const line of lines) {
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
    
    return Array.from(platforms);
  }
}