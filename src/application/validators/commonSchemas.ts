import { z } from 'zod';
import { Platform } from '../../domain/value-objects/Platform';

/**
 * Safe path schema that prevents path traversal and command injection
 */
export const safePathSchema = z.string()
  .refine(
    (path) => !path.includes('..') && !path.includes('~'),
    { message: 'Path traversal patterns are not allowed' }
  )
  .refine(
    (path) => !path.includes('$') && !path.includes('`') && !path.includes(';'),
    { message: 'Command injection patterns are not allowed' }
  );

/**
 * Platform validation schema
 */
export const platformSchema = z.nativeEnum(Platform);

/**
 * Build configuration schema
 * Allows any string configuration (Debug, Release, Beta, Staging, etc.)
 */
export const configurationSchema = z.string().optional().default('Debug');

/**
 * Time interval schema for log filtering
 */
export const timeIntervalSchema = z.string()
  .regex(/^\d+[msh]$/, { message: 'Time interval must be in format: 1m, 5m, 1h' })
  .optional()
  .default('5m');