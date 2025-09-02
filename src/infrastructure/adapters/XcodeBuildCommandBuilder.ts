import { Platform } from '../../types.js';
import { PlatformInfo } from '../../domain/value-objects/PlatformInfo.js';
import { IBuildCommandBuilder, BuildOptions } from '../../application/ports/BuildPorts.js';

/**
 * Builds xcodebuild CLI commands for build operations
 * Single Responsibility: Construct xcodebuild-specific build commands
 */
export class XcodeBuildCommandBuilder implements IBuildCommandBuilder {
  build(
    projectPath: string,
    isWorkspace: boolean,
    options: BuildOptions = {}
  ): string {
    const {
      scheme,
      configuration = 'Debug',
      platform = Platform.iOS,
      deviceId,
      derivedDataPath
    } = options;
    
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    let command = `xcodebuild ${projectFlag} "${projectPath}"`;
    
    if (scheme) {
      command += ` -scheme "${scheme}"`;
    }
    
    command += ` -configuration "${configuration}"`;
    
    // Determine destination
    const platformInfo = PlatformInfo.fromPlatform(platform);
    let destination: string;
    if (deviceId) {
      destination = platformInfo.generateDestination(deviceId);
    } else {
      destination = platformInfo.generateGenericDestination();
    }
    command += ` -destination '${destination}'`;
    
    if (derivedDataPath) {
      command += ` -derivedDataPath "${derivedDataPath}"`;
    }
    
    command += ` build`;
    
    // Pipe through xcbeautify for clean output
    command = `set -o pipefail && ${command} 2>&1 | xcbeautify`;
    
    return command;
  }
}