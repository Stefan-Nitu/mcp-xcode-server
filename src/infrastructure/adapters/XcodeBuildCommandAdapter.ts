import { IBuildCommand, BuildCommandOptions } from '../../application/ports/BuildPorts.js';

/**
 * Infrastructure adapter that builds xcodebuild CLI commands
 * 
 * Single Responsibility: Construct xcodebuild command strings from simple inputs
 * - Takes already-mapped values (no domain concepts)
 * - No dependency on BuildDestinationMapper
 * - Pure string concatenation
 */

export class XcodeBuildCommandAdapter implements IBuildCommand {
  /**
   * Build an xcodebuild command string
   * @param projectPath Path to .xcodeproj or .xcworkspace file
   * @param isWorkspace True if projectPath is a workspace
   * @param options Build options with already-mapped values
   * @returns Complete xcodebuild command string
   */
  build(
    projectPath: string,
    isWorkspace: boolean,
    options: BuildCommandOptions
  ): string {
    const {
      scheme,
      configuration = 'Debug',
      destination,
      additionalSettings = [],
      derivedDataPath
    } = options;
    
    // Start building the command
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    let command = `xcodebuild ${projectFlag} "${projectPath}"`;
    
    // Add scheme
    command += ` -scheme "${scheme}"`;
    
    // Add configuration
    command += ` -configuration "${configuration}"`;
    
    // Add destination (already formatted)
    command += ` -destination '${destination}'`;
    
    // Add additional settings if provided
    if (additionalSettings.length > 0) {
      command += ` ${additionalSettings.join(' ')}`;
    }
    
    // Add derived data path if provided
    if (derivedDataPath) {
      command += ` -derivedDataPath "${derivedDataPath}"`;
    }
    
    // Add build action
    command += ` build`;
    
    // Pipe through xcbeautify for clean output
    command = `set -o pipefail && ${command} 2>&1 | xcbeautify`;
    
    return command;
  }
}