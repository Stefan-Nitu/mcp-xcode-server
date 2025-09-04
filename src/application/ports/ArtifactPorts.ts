/**
 * Port interfaces for build artifact management
 * 
 * These ports define how the application layer locates
 * and manages build artifacts (apps, frameworks, etc.)
 */

export interface IAppLocator {
  findApp(derivedDataPath: string): Promise<string | undefined>;
}