import { Platform } from '../../types.js';

// Port types
export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ExecutionOptions {
  maxBuffer?: number;
  timeout?: number;
  shell?: string;
}

export interface BuildOptions {
  scheme?: string;
  configuration?: string;
  platform?: Platform;
  deviceId?: string;
  derivedDataPath?: string;
}

export interface TestResult {
  passed: number;
  failed: number;
  success: boolean;
  failingTests?: Array<{ identifier: string; reason: string }>;
}

/**
 * Interface for platform validation
 */
export interface IPlatformValidator {
  validate(
    projectPath: string,
    isWorkspace: boolean,
    scheme: string | undefined,
    platform: Platform
  ): Promise<void>;
}

/**
 * Interface for build command construction
 */
export interface IBuildCommandBuilder {
  build(
    projectPath: string,
    isWorkspace: boolean,
    options: BuildOptions
  ): string;
}

export interface TestOptions {
  scheme?: string;
  configuration?: string;
  platform?: Platform;
  deviceId?: string;
  testFilter?: string;
  testTarget?: string;
}

/**
 * Interface for test command construction
 */
export interface ITestCommandBuilder {
  build(
    projectPath: string,
    isWorkspace: boolean,
    resultBundlePath: string,
    options: TestOptions
  ): string;
}

/**
 * Interface for clean command construction
 */
export interface ICleanCommandBuilder {
  build(
    projectPath: string,
    isWorkspace: boolean,
    options: { scheme?: string; configuration?: string }
  ): string;
}

/**
 * Interface for command execution
 */
export interface ICommandExecutor {
  execute(
    command: string,
    options?: ExecutionOptions
  ): Promise<ExecutionResult>;
}

/**
 * Interface for app location
 */
export interface IAppLocator {
  findApp(derivedDataPath: string): Promise<string | undefined>;
}

/**
 * Interface for test result parsing
 */
export interface ITestResultParser {
  parseXcresult(
    resultBundlePath: string,
    output?: string
  ): Promise<TestResult>;
}