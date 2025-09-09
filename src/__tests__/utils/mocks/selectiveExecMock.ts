import type { ExecOptions, ChildProcess } from 'child_process';
import type { NodeExecError } from '../types/execTypes.js';

type ExecCallback = (error: NodeExecError | null, stdout: string, stderr: string) => void;
type ExecFunction = {
  (command: string, callback: ExecCallback): ChildProcess;
  (command: string, options: ExecOptions, callback: ExecCallback): ChildProcess;
};

export interface MockResponse {
  error?: NodeExecError;
  stdout?: string;
  stderr?: string;
}

/**
 * Creates a selective exec mock that only mocks specific commands
 * and delegates others to the real exec implementation
 */
export function createSelectiveExecMock(
  commandFilter: (cmd: string) => boolean,
  getMockResponse: () => MockResponse | undefined,
  actualExec: ExecFunction
) {
  return (cmd: string, ...args: unknown[]) => {
    // Handle both (cmd, callback) and (cmd, options, callback) signatures
    const callback = typeof args[0] === 'function' ? args[0] as ExecCallback : args[1] as ExecCallback;
    const options = typeof args[0] === 'function' ? {} : args[0] as ExecOptions;
    
    if (commandFilter(cmd)) {
      const response = getMockResponse();
      if (response) {
        process.nextTick(() => {
          if (response.error) {
            callback(response.error, response.stdout || '', response.stderr || '');
          } else {
            callback(null, response.stdout || '', response.stderr || '');
          }
        });
      } else {
        process.nextTick(() => {
          const error = new Error(`No mock response configured for: ${cmd}`) as NodeExecError;
          error.code = 1;
          error.stdout = '';
          error.stderr = '';
          callback(error, '', '');
        });
      }
      return;
    }
    
    // Delegate to real exec for other commands
    return actualExec(cmd, options, callback);
  };
}