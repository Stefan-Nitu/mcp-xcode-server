import { Platform } from '../../../types.js';
import { TestResult } from './TestResultParser.js';
import { ExecutionResult, ExecutionOptions } from './CommandExecutor.js';
import { BuildOptions } from './BuildCommandBuilder.js';
import { TestOptions } from './TestCommandBuilder.js';

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