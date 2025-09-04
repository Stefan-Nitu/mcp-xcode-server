/**
 * Port interfaces for command execution
 * 
 * These are general infrastructure ports that can be used
 * by any use case that needs to execute external commands.
 */

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ExecutionOptions {
  maxBuffer?: number;
  timeout?: number;
  shell?: string;
}

export interface ICommandExecutor {
  execute(
    command: string,
    options?: ExecutionOptions
  ): Promise<ExecutionResult>;
}