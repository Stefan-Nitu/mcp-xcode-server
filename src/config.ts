import { homedir } from 'os';
import path from 'path';

/**
 * Configuration for MCP Xcode Server
 */
export const config = {
  /**
   * Base path for MCP-Xcode DerivedData
   * Uses Xcode's standard location but in MCP-Xcode subfolder
   */
  derivedDataBasePath: path.join(homedir(), 'Library', 'Developer', 'Xcode', 'DerivedData', 'MCP-Xcode'),
  
  /**
   * Get DerivedData path for a specific project
   */
  getDerivedDataPath(projectPath: string): string {
    const projectName = path.basename(projectPath, path.extname(projectPath));
    return path.join(this.derivedDataBasePath, projectName);
  }
};