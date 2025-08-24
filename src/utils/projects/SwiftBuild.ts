import { execAsync } from '../../utils.js';
import { createModuleLogger } from '../../logger.js';

const logger = createModuleLogger('SwiftBuild');

export interface SwiftBuildOptions {
  configuration?: 'Debug' | 'Release';
  product?: string;
  target?: string;
}

export interface SwiftRunOptions {
  executable?: string;
  arguments?: string[];
  configuration?: 'Debug' | 'Release';
}

export interface SwiftTestOptions {
  filter?: string;
  configuration?: 'Debug' | 'Release';
}

/**
 * Handles Swift package commands (build, run, test)
 */
export class SwiftBuild {
  /**
   * Build a Swift package
   */
  async build(
    packagePath: string,
    options: SwiftBuildOptions = {}
  ): Promise<{ success: boolean; output: string }> {
    const { configuration = 'Debug', product, target } = options;
    
    // Convert to lowercase for swift command
    const configFlag = configuration.toLowerCase();
    let command = `swift build --package-path "${packagePath}" -c ${configFlag}`;
    
    if (product) {
      command += ` --product "${product}"`;
    }
    
    if (target) {
      command += ` --target "${target}"`;
    }
    
    logger.debug({ command }, 'Build command');
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024
      });
      
      const output = stdout + (stderr ? `\n${stderr}` : '');
      
      logger.info({ packagePath, configuration }, 'Build succeeded');
      
      return {
        success: true,
        output
      };
    } catch (error: any) {
      logger.error({ error: error.message, packagePath }, 'Build failed');
      
      // Return error output for debugging
      const output = (error.stdout || '') + (error.stderr ? `\n${error.stderr}` : '');
      throw new Error(`Build failed: ${error.message}\n${output}`);
    }
  }
  
  /**
   * Run a Swift package executable
   */
  async run(
    packagePath: string,
    options: SwiftRunOptions = {}
  ): Promise<{ success: boolean; output: string }> {
    const { executable, arguments: args = [], configuration = 'Debug' } = options;
    
    // Convert to lowercase for swift command
    const configFlag = configuration.toLowerCase();
    let command = `swift run --package-path "${packagePath}" -c ${configFlag}`;
    
    if (executable) {
      command += ` "${executable}"`;
    }
    
    if (args.length > 0) {
      command += ` ${args.map(arg => `"${arg}"`).join(' ')}`;
    }
    
    logger.debug({ command }, 'Run command');
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024
      });
      
      const output = stdout + (stderr ? `\n${stderr}` : '');
      
      logger.info({ packagePath, executable }, 'Run succeeded');
      
      return {
        success: true,
        output
      };
    } catch (error: any) {
      logger.error({ error: error.message, packagePath }, 'Run failed');
      
      // Return error output
      const output = (error.stdout || '') + (error.stderr ? `\n${error.stderr}` : '');
      throw new Error(`Run failed: ${error.message}\n${output}`);
    }
  }
  
  /**
   * Test a Swift package
   */
  async test(
    packagePath: string,
    options: SwiftTestOptions = {}
  ): Promise<{ 
    success: boolean; 
    output: string;
    passed: number;
    failed: number;
  }> {
    const { filter, configuration = 'Debug' } = options;
    
    // Convert to lowercase for swift command
    const configFlag = configuration.toLowerCase();
    let command = `swift test --package-path "${packagePath}" -c ${configFlag}`;
    
    if (filter) {
      command += ` --filter "${filter}"`;
    }
    
    logger.debug({ command }, 'Test command');
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024
      });
      
      const output = stdout + (stderr ? `\n${stderr}` : '');
      
      // Parse test results
      let passed = 0;
      let failed = 0;
      
      // Look for test summary
      const summaryMatch = output.match(/Test Suite .+ passed.+\n.+ (\d+) tests?.+ passed, (\d+) failed/);
      if (summaryMatch) {
        passed = parseInt(summaryMatch[1], 10);
        failed = parseInt(summaryMatch[2], 10);
      } else {
        // Alternative parsing for individual test results
        const passedMatches = output.match(/✓|passed/gi);
        const failedMatches = output.match(/✗|failed/gi);
        passed = passedMatches ? passedMatches.length : 0;
        failed = failedMatches ? failedMatches.length : 0;
      }
      
      logger.info({ packagePath, passed, failed }, 'Tests completed');
      
      return {
        success: failed === 0,
        output,
        passed,
        failed
      };
    } catch (error: any) {
      logger.error({ error: error.message, packagePath }, 'Tests failed');
      
      // Try to extract test counts from error output
      const output = (error.stdout || '') + (error.stderr ? `\n${error.stderr}` : '');
      
      let passed = 0;
      let failed = 0;
      
      const summaryMatch = output.match(/Test Suite .+ failed.+\n.+ (\d+) tests?.+ passed, (\d+) failed/);
      if (summaryMatch) {
        passed = parseInt(summaryMatch[1], 10);
        failed = parseInt(summaryMatch[2], 10);
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
   * Clean Swift package build artifacts
   */
  async clean(packagePath: string): Promise<void> {
    const command = `swift package clean --package-path "${packagePath}"`;
    
    logger.debug({ command }, 'Clean command');
    
    try {
      await execAsync(command);
      logger.info({ packagePath }, 'Clean succeeded');
    } catch (error: any) {
      logger.error({ error: error.message, packagePath }, 'Clean failed');
      throw new Error(`Clean failed: ${error.message}`);
    }
  }
}