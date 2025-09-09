import type { ExecOptions, ExecException } from 'child_process';

type ExecCallback = (error: ExecException | null, stdout: string, stderr: string) => void;
type ExecFunction = (command: string, options: ExecOptions, callback: ExecCallback) => void;

/**
 * Creates a promisified version of exec that matches Node's util.promisify behavior
 * Returns {stdout, stderr} on success, attaches them to error on failure
 */
export function createPromisifiedExec(execFn: ExecFunction) {
  return (cmd: string, options?: ExecOptions) => 
    new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      execFn(cmd, options || {}, (error, stdout, stderr) => {
        if (error) {
          Object.assign(error, { stdout, stderr });
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
}