/**
 * Node.js exec error with stdout/stderr attached
 * This is how Node.js exec actually behaves - it attaches stdout/stderr to the error
 */
export interface NodeExecError extends Error {
  code?: number;
  stdout?: string;
  stderr?: string;
}

/**
 * Mock call type for exec function  
 */
export type ExecMockCall = [string, ...unknown[]];