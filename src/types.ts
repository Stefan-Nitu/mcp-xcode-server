/**
 * Type definitions for Apple Simulator MCP Server
 */

// Re-export Platform from domain for backward compatibility
// TODO: Update all imports to use domain directly
export { Platform } from './shared/domain/Platform.js';

export interface SimulatorDevice {
  udid: string;
  name: string;
  state: 'Booted' | 'Shutdown' | 'Creating' | 'Booting' | 'ShuttingDown';
  deviceTypeIdentifier: string;
  runtime: string;
  isAvailable?: boolean;
}

export interface TestResult {
  success: boolean;
  output: string;
  errors?: string;
  testCount?: number;
  failureCount?: number;
}

export interface Tool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}