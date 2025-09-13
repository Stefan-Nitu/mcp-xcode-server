/**
 * Represents a missing dependency
 */
export interface MissingDependency {
  readonly name: string;
  readonly installCommand?: string;
}

/**
 * Checks for system dependencies required by MCP tools
 */
export interface IDependencyChecker {
  /**
   * Check if the specified dependencies are available
   * @param dependencies List of dependency names to check
   * @returns List of missing dependencies
   */
  check(dependencies: string[]): Promise<MissingDependency[]>;
}