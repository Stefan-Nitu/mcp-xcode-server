/**
 * Centralized error handling for build operations
 */

// Re-export common types
export type {
  CompileError,
  BuildError,
  BuildErrorType,
  FormattedError
} from './types.js';

// Xcode error handling
export { handleXcodeError, parseCompileErrors, parseBuildErrors } from './xcode/index.js';
export type { XcodeError, ErrorFormatterOptions } from './xcode/index.js';

// Swift Package error handling  
export { handleSwiftPackageError, parseSwiftCompileErrors, parseSwiftBuildErrors } from './swift-package/index.js';
export type { SwiftPackageError, SwiftPackageErrorOptions } from './swift-package/index.js';

// Common formatters used by both
export { formatCompileErrors, formatBuildErrors } from './formatter.js';