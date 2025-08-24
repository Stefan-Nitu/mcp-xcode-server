import { execAsync } from '../../utils.js';
import { createModuleLogger } from '../../logger.js';
import { Platform } from '../../types.js';
import { PlatformHandler } from '../../platformHandler.js';
import { existsSync } from 'fs';

const logger = createModuleLogger('XcodeBuild');

export interface BuildOptions {
  scheme?: string;
  configuration?: string;
  platform?: Platform;
  deviceId?: string;
  derivedDataPath?: string;
}

export interface TestOptions {
  scheme?: string;
  configuration?: string;
  platform?: Platform;
  deviceId?: string;
  testFilter?: string;
  testTarget?: string;
}

/**
 * Handles xcodebuild commands for Xcode projects
 */
export class XcodeBuild {
  /**
   * Validates that a scheme supports the requested platform
   * @throws Error if the platform is not supported
   */
  private async validatePlatformSupport(
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
    
    try {
      logger.debug({ command }, 'Validating platform support');
      // Just check if the command succeeds - we don't need the output
      await execAsync(command, { 
        maxBuffer: 1024 * 1024, // 1MB is enough for validation
        timeout: 10000 // 10 second timeout for validation
      });
      logger.debug({ platform, scheme }, 'Platform validation succeeded');
    } catch (error: any) {
      const stderr = error.stderr || '';
      const stdout = error.stdout || '';
      
      // Check if error indicates platform mismatch
      if (stderr.includes('Available destinations for') || stdout.includes('Available destinations for')) {
        // Extract available platforms from the error message
        const availablePlatforms = this.extractAvailablePlatforms(stderr + stdout);
        throw new Error(
          `Platform '${platform}' is not supported by scheme '${scheme || 'default'}'. ` +
          `Available platforms: ${availablePlatforms.join(', ')}`
        );
      }
      
      // Some other error - let it pass through for now
      logger.warn({ error: error.message }, 'Platform validation check failed, continuing anyway');
    }
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
  /**
   * Build an Xcode project or workspace
   */
  async build(
    projectPath: string, 
    isWorkspace: boolean,
    options: BuildOptions = {}
  ): Promise<{ success: boolean; output: string; appPath?: string }> {
    const {
      scheme,
      configuration = 'Debug',
      platform = Platform.iOS,
      deviceId,
      derivedDataPath = './DerivedData'
    } = options;
    
    // Validate platform support first
    await this.validatePlatformSupport(projectPath, isWorkspace, scheme, platform);
    
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    let command = `xcodebuild ${projectFlag} "${projectPath}"`;
    
    if (scheme) {
      command += ` -scheme "${scheme}"`;
    }
    
    command += ` -configuration "${configuration}"`;
    
    // Determine destination
    let destination: string;
    if (deviceId) {
      destination = PlatformHandler.getDestination(platform, deviceId);
    } else {
      destination = PlatformHandler.getGenericDestination(platform);
    }
    command += ` -destination '${destination}'`;
    
    command += ` -derivedDataPath "${derivedDataPath}" build`;
    
    logger.debug({ command }, 'Build command');
    
    try {
      const { stdout, stderr } = await execAsync(command, { 
        maxBuffer: 50 * 1024 * 1024 
      });
      
      const output = stdout + (stderr ? `\n${stderr}` : '');
      
      // Try to find the built app using find command (more reliable than parsing output)
      let appPath: string | undefined;
      try {
        const { stdout: findOutput } = await execAsync(
          `find "${derivedDataPath}" -name "*.app" -type d | head -1`
        );
        appPath = findOutput.trim() || undefined;
        
        if (appPath) {
          logger.info({ appPath }, 'Found app at path');
          
          // Verify the app actually exists
          if (!existsSync(appPath)) {
            logger.error({ appPath }, 'App path does not exist!');
            appPath = undefined;
          }
        } else {
          logger.warn({ derivedDataPath }, 'No app found in DerivedData');
        }
      } catch (error: any) {
        logger.error({ error: error.message, derivedDataPath }, 'Error finding app path');
      }
      
      logger.info({ projectPath, scheme, configuration, platform }, 'Build succeeded');
      
      return {
        success: true,
        output,
        appPath
      };
    } catch (error: any) {
      logger.error({ error: error.message, projectPath }, 'Build failed');
      
      // Return more detailed error information
      const stdout = error.stdout || '';
      const stderr = error.stderr || '';
      const errorMessage = error.message || 'Unknown build error';
      
      // Prefer stderr if it has the actual error details, otherwise use stdout
      let detailedError: string;
      if (stderr && stderr.includes('xcodebuild: error')) {
        detailedError = stderr;
      } else if (stdout && stdout.includes('xcodebuild')) {
        detailedError = stdout;
      } else if (stderr) {
        detailedError = stderr;
      } else {
        detailedError = errorMessage;
      }
      
      throw new Error(detailedError);
    }
  }
  
  /**
   * Run tests for an Xcode project
   */
  async test(
    projectPath: string,
    isWorkspace: boolean,
    options: TestOptions = {}
  ): Promise<{ success: boolean; output: string; passed: number; failed: number }> {
    const {
      scheme,
      configuration = 'Debug',
      platform = Platform.iOS,
      deviceId,
      testFilter,
      testTarget
    } = options;
    
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    let command = `xcodebuild ${projectFlag} "${projectPath}"`;
    
    if (scheme) {
      command += ` -scheme "${scheme}"`;
    }
    
    command += ` -configuration "${configuration}"`;
    
    // Determine destination
    let destination: string;
    if (deviceId) {
      destination = PlatformHandler.getDestination(platform, deviceId);
    } else {
      destination = PlatformHandler.getGenericDestination(platform);
    }
    command += ` -destination '${destination}'`;
    
    // Add test target/filter if provided
    if (testTarget) {
      command += ` -only-testing:${testTarget}`;
    }
    if (testFilter) {
      command += ` -only-testing:${testFilter}`;
    }
    
    command += ' test';
    
    logger.debug({ command }, 'Test command');
    
    try {
      const { stdout, stderr } = await execAsync(command, { 
        maxBuffer: 50 * 1024 * 1024 
      });
      
      const output = stdout + (stderr ? `\n${stderr}` : '');
      
      // Parse test results
      let passed = 0;
      let failed = 0;
      
      const passedMatch = output.match(/(\d+) passed/);
      if (passedMatch) {
        passed = parseInt(passedMatch[1], 10);
      }
      
      const failedMatch = output.match(/(\d+) failed/);
      if (failedMatch) {
        failed = parseInt(failedMatch[1], 10);
      }
      
      logger.info({ projectPath, passed, failed }, 'Tests completed');
      
      return {
        success: failed === 0,
        output,
        passed,
        failed
      };
    } catch (error: any) {
      logger.error({ error: error.message, projectPath }, 'Tests failed');
      
      // Try to extract test counts even from failure
      const output = error.stdout || '';
      let passed = 0;
      let failed = 0;
      
      const passedMatch = output.match(/(\d+) passed/);
      if (passedMatch) {
        passed = parseInt(passedMatch[1], 10);
      }
      
      const failedMatch = output.match(/(\d+) failed/);
      if (failedMatch) {
        failed = parseInt(failedMatch[1], 10);
      }
      
      return {
        success: false,
        output,
        passed,
        failed
      };
    }
  }
  
  /**
   * Clean build artifacts
   */
  async clean(
    projectPath: string,
    isWorkspace: boolean,
    options: { scheme?: string; configuration?: string } = {}
  ): Promise<void> {
    const { scheme, configuration = 'Debug' } = options;
    
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    let command = `xcodebuild ${projectFlag} "${projectPath}"`;
    
    if (scheme) {
      command += ` -scheme "${scheme}"`;
    }
    
    command += ` -configuration "${configuration}" clean`;
    
    logger.debug({ command }, 'Clean command');
    
    try {
      await execAsync(command);
      logger.info({ projectPath }, 'Clean succeeded');
    } catch (error: any) {
      logger.error({ error: error.message, projectPath }, 'Clean failed');
      throw new Error(`Clean failed: ${error.message}`);
    }
  }
}