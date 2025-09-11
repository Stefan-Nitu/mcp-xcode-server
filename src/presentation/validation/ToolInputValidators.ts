import { z } from 'zod';

/**
 * Common validation schemas with consistent error messages
 * Reusable across all tools and controllers
 * 
 * Error message conventions:
 * - required_error: "X is required" (field missing from input)
 * - .min(1): "X cannot be empty" (field exists but empty string)
 * - .refine(trim check): "X cannot be whitespace only" (field is whitespace-only)
 * - invalid_type_error: "X must be a [type]" (wrong type provided)
 */

/**
 * Project path validation
 */
export const projectPathSchema = z.string({
    required_error: 'Project path is required',
    invalid_type_error: 'Project path must be a string'
  })
  .min(1, 'Project path cannot be empty')
  .refine(
    (path) => path.length === 0 || path.endsWith('.xcodeproj') || path.endsWith('.xcworkspace'),
    'Project path must be an .xcodeproj or .xcworkspace file'
  );

/**
 * Scheme validation
 */
export const schemeSchema = z.string({
    required_error: 'Scheme is required',
    invalid_type_error: 'Scheme must be a string'
  })
  .min(1, 'Scheme cannot be empty')
  .refine(
    (scheme) => scheme.length === 0 || scheme.trim().length > 0,
    'Scheme cannot be whitespace only'
  );

/**
 * Configuration validation (Debug, Release, etc.)
 * Optional with default value
 */
export const configurationSchema = z.string({
    required_error: 'Configuration is required',
    invalid_type_error: 'Configuration must be a string'
  })
  .min(1, 'Configuration cannot be empty')
  .default('Debug');

/**
 * Device ID validation
 */
export const deviceIdSchema = z.string({
    required_error: 'Device ID is required',
    invalid_type_error: 'Device ID must be a string'
  })
  .min(1, 'Device ID cannot be empty')
  .refine(
    (id) => id.length === 0 || id.trim().length > 0,
    'Device ID cannot be whitespace only'
  );

/**
 * Bundle ID validation
 */
export const bundleIdSchema = z.string({
    required_error: 'Bundle ID is required',
    invalid_type_error: 'Bundle ID must be a string'
  })
  .min(1, 'Bundle ID cannot be empty')
  .regex(
    /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/,
    'Bundle ID must be in reverse domain format (e.g., com.company.app)'
  );

/**
 * File path validation (general)
 */
export const filePathSchema = z.string({
    required_error: 'File path is required',
    invalid_type_error: 'File path must be a string'
  })
  .min(1, 'File path cannot be empty')
  .refine(
    (path) => path.startsWith('/') || path.startsWith('~'),
    'File path must be absolute'
  );

/**
 * Directory path validation
 */
export const directoryPathSchema = z.string({
    required_error: 'Directory path is required',
    invalid_type_error: 'Directory path must be a string'
  })
  .min(1, 'Directory path cannot be empty')
  .refine(
    (path) => !path.includes('*') && !path.includes('?'),
    'Directory path cannot contain wildcards'
  );

/**
 * Derived data path validation (optional)
 */
export const derivedDataPathSchema = z.string({
    invalid_type_error: 'Derived data path must be a string'
  })
  .min(1, 'Derived data path cannot be empty')
  .refine(
    (path) => path.startsWith('/') || path.startsWith('~'),
    'Derived data path must be absolute'
  )
  .optional();

/**
 * Test filter validation (optional)
 */
export const testFilterSchema = z.string({
    invalid_type_error: 'Test filter must be a string'
  })
  .min(1, 'Test filter cannot be empty')
  .optional();

/**
 * Timeout validation (in seconds)
 */
export const timeoutSchema = z.number()
  .int('Timeout must be an integer')
  .positive('Timeout must be positive')
  .max(3600, 'Timeout cannot exceed 1 hour (3600 seconds)')
  .optional()
  .default(300); // 5 minutes default

/**
 * Port number validation
 */
export const portSchema = z.number()
  .int('Port must be an integer')
  .min(1024, 'Port must be 1024 or higher (unprivileged)')
  .max(65535, 'Port must be 65535 or lower');

/**
 * App path validation (.app bundles)
 */
export const appPathSchema = z.string({
    required_error: 'App path is required',
    invalid_type_error: 'App path must be a string'
  })
  .min(1, 'App path cannot be empty')
  .refine(
    (path) => path.length === 0 || path.endsWith('.app'),
    'App path must be a .app bundle'
  )
  .refine(
    (path) => path.length === 0 || !path.includes('../..'),
    'Invalid app path: path traversal detected'
  );

/**
 * Simulator ID validation (optional)
 */
export const simulatorIdSchema = z.string({
    invalid_type_error: 'Simulator ID must be a string'
  })
  .min(1, 'Simulator ID cannot be empty')
  .refine(
    (id) => id.length === 0 || id.trim().length > 0,
    'Simulator ID cannot be whitespace only'
  )
  .optional();

/**
 * Platform validation (for tools that accept platform directly)
 */
export const platformSchema = z.enum(
  ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS'],
  {
    errorMap: () => ({ message: 'Platform must be one of: iOS, macOS, tvOS, watchOS, visionOS' })
  }
);

/**
 * Build destination validation
 */
export const buildDestinationSchema = z.enum([
  'iOSSimulator', 'iOSDevice', 'iOSSimulatorUniversal',
  'macOS', 'macOSUniversal',
  'tvOSSimulator', 'tvOSDevice', 'tvOSSimulatorUniversal',
  'watchOSSimulator', 'watchOSDevice', 'watchOSSimulatorUniversal',
  'visionOSSimulator', 'visionOSDevice', 'visionOSSimulatorUniversal'
], {
  errorMap: () => ({ 
    message: 'Invalid destination. Use format: [platform][Simulator|Device|SimulatorUniversal]' 
  })
});

/**
 * Common boolean flags
 */
export const verboseSchema = z.boolean()
  .optional()
  .default(false);

export const cleanBuildSchema = z.boolean()
  .optional()
  .default(false);

export const quietSchema = z.boolean()
  .optional()
  .default(false);

/**
 * Helper function to create consistent error messages
 */
export function createRequiredFieldError(fieldName: string): string {
  return `${fieldName} is required`;
}

export function createInvalidFormatError(fieldName: string, expectedFormat: string): string {
  return `${fieldName} must be in format: ${expectedFormat}`;
}

export function createInvalidValueError(fieldName: string, validValues: string[]): string {
  return `${fieldName} must be one of: ${validValues.join(', ')}`;
}