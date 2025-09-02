import { BuildIssue } from '../value-objects/BuildIssue.js';

/**
 * Domain Entity: Represents the result of a build operation
 */
export class BuildResult {
  constructor(
    public readonly success: boolean,
    public readonly output: string,
    public readonly appPath: string | undefined,
    public readonly logPath: string | undefined,
    public readonly issues: BuildIssue[],
    public readonly exitCode: number
  ) {}
  
  static success(
    output: string,
    appPath?: string,
    logPath?: string
  ): BuildResult {
    return new BuildResult(true, output, appPath, logPath, [], 0);
  }
  
  static failure(
    output: string,
    issues: BuildIssue[],
    exitCode: number,
    logPath?: string
  ): BuildResult {
    return new BuildResult(false, output, undefined, logPath, issues, exitCode);
  }
  
  hasErrors(): boolean {
    return this.issues.some(issue => issue.isError());
  }
  
  getErrors(): BuildIssue[] {
    return this.issues.filter(issue => issue.isError());
  }
  
  getWarnings(): BuildIssue[] {
    return this.issues.filter(issue => issue.isWarning());
  }
}