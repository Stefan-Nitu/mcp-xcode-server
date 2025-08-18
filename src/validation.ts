/**
 * Input validation schemas for MCP tool arguments
 * Security: Prevents command injection and path traversal attacks
 */

import { z } from 'zod';
import { Platform } from './types.js';

// Custom validators
const safePathSchema = z.string()
  .refine(
    (path) => !path.includes('..') && !path.includes('~'),
    { message: 'Path traversal patterns are not allowed' }
  )
  .refine(
    (path) => !path.includes('$') && !path.includes('`') && !path.includes(';'),
    { message: 'Command injection patterns are not allowed' }
  );

const platformSchema = z.nativeEnum(Platform);

const configurationSchema = z.enum(['Debug', 'Release']).optional().default('Debug');

const timeIntervalSchema = z.string()
  .regex(/^\d+[msh]$/, { message: 'Time interval must be in format: 1m, 5m, 1h' })
  .optional()
  .default('5m');

// Tool argument schemas
export const listSimulatorsSchema = z.object({
  showAll: z.boolean().optional().default(false),
  platform: platformSchema.optional()
});

export const bootSimulatorSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required')
});

export const shutdownSimulatorSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required')
});

export const buildProjectSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string().optional(),
  platform: platformSchema.optional().default(Platform.iOS),
  deviceId: z.string().optional(),
  configuration: configurationSchema
});

export const runProjectSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string().optional(),
  platform: platformSchema.optional().default(Platform.iOS),
  deviceId: z.string().optional(),
  configuration: configurationSchema
});

export const testProjectSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string().optional(),
  platform: platformSchema.optional().default(Platform.iOS),
  deviceId: z.string().optional(),
  configuration: configurationSchema,
  testTarget: z.string().optional(),
  testFilter: z.string().optional(),
  parallelTesting: z.boolean().optional().default(false)
});

export const testSPMModuleSchema = z.object({
  packagePath: safePathSchema,
  platform: platformSchema.optional().default(Platform.macOS),
  testFilter: z.string().optional(),
  osVersion: z.string()
    .regex(/^\d+\.\d+$/, { message: 'OS version must be in format: 17.2' })
    .optional()
});

export const installAppSchema = z.object({
  appPath: safePathSchema,
  deviceId: z.string().optional()
});

export const uninstallAppSchema = z.object({
  bundleId: z.string()
    .regex(/^[a-zA-Z0-9.-]+$/, { message: 'Invalid bundle ID format' }),
  deviceId: z.string().optional()
});

export const viewSimulatorScreenSchema = z.object({
  deviceId: z.string().optional()
});

export const getDeviceLogsSchema = z.object({
  deviceId: z.string().optional(),
  predicate: z.string()
    .refine(
      (pred) => !pred.includes('`') && !pred.includes('$'),
      { message: 'Command injection patterns not allowed in predicate' }
    )
    .optional(),
  last: timeIntervalSchema
});

// Type exports for use in the server
export type ListSimulatorsArgs = z.infer<typeof listSimulatorsSchema>;
export type BootSimulatorArgs = z.infer<typeof bootSimulatorSchema>;
export type ShutdownSimulatorArgs = z.infer<typeof shutdownSimulatorSchema>;
export type BuildProjectArgs = z.infer<typeof buildProjectSchema>;
export type RunProjectArgs = z.infer<typeof runProjectSchema>;
export type TestProjectArgs = z.infer<typeof testProjectSchema>;
export type TestSPMModuleArgs = z.infer<typeof testSPMModuleSchema>;
export type InstallAppArgs = z.infer<typeof installAppSchema>;
export type UninstallAppArgs = z.infer<typeof uninstallAppSchema>;
export type ViewSimulatorScreenArgs = z.infer<typeof viewSimulatorScreenSchema>;
export type GetDeviceLogsArgs = z.infer<typeof getDeviceLogsSchema>;

export const cleanBuildSchema = z.object({
  projectPath: safePathSchema.optional(),
  scheme: z.string().optional(),
  platform: platformSchema.optional().default(Platform.iOS),
  configuration: configurationSchema,
  cleanTarget: z.enum(['build', 'derivedData', 'testResults', 'all']).optional().default('build'),
  derivedDataPath: z.string().optional().default('./DerivedData')
});

export type CleanBuildArgs = z.infer<typeof cleanBuildSchema>;