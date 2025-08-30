/**
 * Swift Package Manager specific error types
 */

import { CompileError, BuildError } from '../types.js';

/**
 * Swift Package specific error with metadata
 */
export interface SwiftPackageError extends Error {
  compileErrors?: CompileError[];
  buildErrors?: BuildError[];
  logPath?: string;
}

/**
 * Swift-specific build error types
 */
export type SwiftBuildErrorType = 
  | 'dependency'
  | 'manifest'
  | 'target'
  | 'product'
  | 'configuration'
  | 'generic';

/**
 * Options for Swift Package error formatting
 */
export interface SwiftPackageErrorOptions {
  configuration: string;
  target?: string;
  product?: string;
  executable?: string;
  logPath?: string;
  maxErrors?: number;
}