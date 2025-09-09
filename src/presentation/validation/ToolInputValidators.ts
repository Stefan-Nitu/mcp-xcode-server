import { z } from 'zod';

/**
 * Common validation schemas with consistent error messages
 * Reusable across all tools and controllers
 */

/**
 * Project path validation
 */
export const projectPathSchema = z.string()
  .min(1, 'Project path is required')
  .refine(
    (path) => path.endsWith('.xcodeproj') || path.endsWith('.xcworkspace'),
    'Project path must be an .xcodeproj or .xcworkspace file'
  );

/**
 * Scheme validation
 */
export const schemeSchema = z.string()
  .min(1, 'Scheme is required')
  .refine(
    (scheme) => scheme.trim().length > 0,
    'Scheme cannot be empty or whitespace'
  );

/**
 * Configuration validation (Debug, Release, etc.)
 */
export const configurationSchema = z.string()
  .min(1, 'Configuration is required')
  .default('Debug');

/**
 * Device ID validation
 */
export const deviceIdSchema = z.string()
  .min(1, 'Device ID is required')
  .refine(
    (id) => id.trim().length > 0,
    'Device ID cannot be empty or whitespace'
  );

/**
 * Bundle ID validation
 */
export const bundleIdSchema = z.string()
  .min(1, 'Bundle ID is required')
  .regex(
    /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/,
    'Bundle ID must be in reverse domain format (e.g., com.company.app)'
  );

/**
 * File path validation (general)
 */
export const filePathSchema = z.string()
  .min(1, 'File path is required')
  .refine(
    (path) => path.startsWith('/') || path.startsWith('~'),
    'File path must be absolute'
  );

/**
 * Directory path validation
 */
export const directoryPathSchema = z.string()
  .min(1, 'Directory path is required')
  .refine(
    (path) => !path.includes('*') && !path.includes('?'),
    'Directory path cannot contain wildcards'
  );

/**
 * Optional derived data path
 */
export const derivedDataPathSchema = z.string()
  .optional()
  .refine(
    (path) => !path || path.startsWith('/') || path.startsWith('~'),
    'Derived data path must be absolute if provided'
  );

/**
 * Test filter validation
 */
export const testFilterSchema = z.string()
  .optional()
  .refine(
    (filter) => !filter || filter.length > 0,
    'Test filter cannot be empty if provided'
  );

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
export const appPathSchema = z.string()
  .min(1, 'App path is required')
  .refine(
    (path) => path.endsWith('.app'),
    'App path must be a .app bundle'
  )
  .refine(
    (path) => !path.includes('../..'),
    'Invalid app path: path traversal detected'
  );

/**
 * Simulator ID validation (optional)
 */
export const simulatorIdSchema = z.string()
  .optional()
  .refine(
    (id) => !id || id.trim().length > 0,
    'Simulator ID cannot be empty if provided'
  );

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