/**
 * Common error type definitions used by both Xcode and Swift Package Manager
 */

/**
 * Compile error from Swift/Objective-C compilation
 */
export interface CompileError {
  type: 'error' | 'warning' | 'note';
  file?: string;
  line?: number;
  column?: number;
  message: string;
  code?: string;
}

/**
 * Common build error types
 */
export type BuildErrorType = 
  | 'compile'
  | 'scheme' 
  | 'signing'
  | 'provisioning'
  | 'dependency'
  | 'configuration'
  | 'sdk'
  | 'destination'
  | 'target'
  | 'product'
  | 'manifest'
  | 'generic';

/**
 * Structured build error
 */
export interface BuildError {
  type: BuildErrorType;
  title: string;
  details?: string;
  suggestion?: string;
}

/**
 * Formatted error result for MCP output
 */
export interface FormattedError {
  content: Array<{
    type: string;
    text: string;
  }>;
}