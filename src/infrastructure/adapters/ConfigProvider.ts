import { IConfigProvider } from '../../application/ports/ConfigPorts.js';
import { homedir } from 'os';
import path from 'path';

/**
 * Infrastructure adapter for configuration access
 * Implements the IConfigProvider port
 * 
 * Self-contained with no external dependencies.
 * Configuration values come from:
 * 1. Environment variables (when available)
 * 2. System defaults (e.g., user home directory)
 * 3. Hardcoded defaults as fallback
 */
export class ConfigProvider implements IConfigProvider {
  private readonly derivedDataBasePath: string;
  
  constructor() {
    // Read from environment or use default
    // This is an infrastructure concern - reading from the environment
    this.derivedDataBasePath = process.env.MCP_XCODE_DERIVED_DATA_PATH ||
      path.join(homedir(), 'Library', 'Developer', 'Xcode', 'DerivedData', 'MCP-Xcode');
  }
  
  getDerivedDataPath(projectPath?: string): string {
    // If we have a project path, use it for the derived data path
    if (projectPath) {
      const projectName = path.basename(projectPath, path.extname(projectPath));
      return path.join(this.derivedDataBasePath, projectName);
    }
    // Otherwise return the base path
    return this.derivedDataBasePath;
  }
  
  getBuildTimeout(): number {
    // Read from environment or use default (10 minutes)
    const timeout = process.env.MCP_XCODE_BUILD_TIMEOUT;
    return timeout ? parseInt(timeout, 10) : 600000;
  }
  
  isXcbeautifyEnabled(): boolean {
    // Read from environment or default to true
    const enabled = process.env.MCP_XCODE_XCBEAUTIFY_ENABLED;
    return enabled ? enabled.toLowerCase() === 'true' : true;
  }
  
  getCustomBuildSettings(): Record<string, string> {
    // Could read from environment as JSON or return empty
    const settings = process.env.MCP_XCODE_CUSTOM_BUILD_SETTINGS;
    if (settings) {
      try {
        return JSON.parse(settings);
      } catch {
        // Invalid JSON, return empty
        return {};
      }
    }
    return {};
  }
}