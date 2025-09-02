/**
 * Port interface for configuration access
 * This is an application-level abstraction
 */

export interface IConfigProvider {
  /**
   * Get the path for DerivedData
   */
  getDerivedDataPath(): string;
  
  /**
   * Get timeout for build operations in milliseconds
   */
  getBuildTimeout(): number;
  
  /**
   * Check if xcbeautify is enabled
   */
  isXcbeautifyEnabled(): boolean;
  
  /**
   * Get any custom build settings
   */
  getCustomBuildSettings(): Record<string, string>;
}