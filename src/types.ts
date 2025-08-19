/**
 * Type definitions for Apple Simulator MCP Server
 */

export enum Platform {
  iOS = 'iOS',
  macOS = 'macOS',
  tvOS = 'tvOS',
  watchOS = 'watchOS',
  visionOS = 'visionOS'
}

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

export interface BuildConfiguration {
  projectPath: string;
  scheme?: string;
  platform?: Platform;
  deviceId?: string;
  configuration?: 'Debug' | 'Release';
}

export interface TestConfiguration extends BuildConfiguration {
  testTarget?: string;
  testFilter?: string;
  parallelTesting?: boolean;
}

export interface PlatformConfig {
  platform: Platform;
  needsSimulator: boolean;
  defaultDevice?: string;
  destinationString: (deviceName?: string) => string;
}

export interface Tool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}