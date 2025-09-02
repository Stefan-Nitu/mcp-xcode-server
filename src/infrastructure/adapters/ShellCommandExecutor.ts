import { execAsync } from '../../utils.js';
import { createModuleLogger } from '../../logger.js';
import { ICommandExecutor, ExecutionResult, ExecutionOptions } from '../../application/ports/BuildPorts.js';

const logger = createModuleLogger('ShellCommandExecutor');

/**
 * Executes shell commands via child process
 * Single Responsibility: Execute shell commands and return results
 */
export class ShellCommandExecutor implements ICommandExecutor {
  /**
   * Execute a command and return the result
   */
  async execute(command: string, options: ExecutionOptions = {}): Promise<ExecutionResult> {
    const {
      maxBuffer = 50 * 1024 * 1024, // 50MB default
      timeout = 300000, // 5 minute default
      shell = '/bin/bash'
    } = options;
    
    logger.debug({ command }, 'Executing command');
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer,
        timeout,
        shell
      });
      
      return {
        stdout,
        stderr,
        exitCode: 0
      };
    } catch (error: any) {
      // Even on failure, return the output
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code || 1
      };
    }
  }
}