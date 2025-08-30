/**
 * Xcode-specific error types
 */

import { CompileError, BuildError } from '../types.js';

/**
 * Xcode error with additional metadata
 */
export interface XcodeError extends Error {
  compileErrors?: CompileError[];
  buildErrors?: BuildError[];
  logPath?: string;
}

/**
 * Options for Xcode error formatting
 */
export interface ErrorFormatterOptions {
  platform: string;
  configuration: string;
  scheme?: string;
  logPath?: string;
  maxErrors?: number;
}

/**
 * Xcode-specific build error types
 */
export type XcodeBuildErrorType = 
  | 'compile'
  | 'scheme' 
  | 'signing'
  | 'provisioning'
  | 'dependency'
  | 'configuration'
  | 'sdk'
  | 'destination'
  | 'generic';