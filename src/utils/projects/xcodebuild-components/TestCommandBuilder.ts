import { Platform } from '../../../types.js';
import { PlatformHandler } from '../../../platformHandler.js';

export interface TestOptions {
  scheme?: string;
  configuration?: string;
  platform?: Platform;
  deviceId?: string;
  testFilter?: string;
  testTarget?: string;
}

/**
 * Builds xcodebuild command for test operations
 * Single Responsibility: Construct test commands only
 */
export class TestCommandBuilder {
  build(
    projectPath: string,
    isWorkspace: boolean,
    resultBundlePath: string,
    options: TestOptions = {}
  ): string {
    const {
      scheme,
      configuration = 'Debug',
      platform = Platform.iOS,
      deviceId,
      testFilter,
      testTarget
    } = options;
    
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    let command = `xcodebuild ${projectFlag} "${projectPath}"`;
    
    if (scheme) {
      command += ` -scheme "${scheme}"`;
    }
    
    command += ` -configuration "${configuration}"`;
    
    // Determine destination
    let destination: string;
    if (deviceId) {
      destination = PlatformHandler.getDestination(platform, deviceId);
    } else {
      destination = PlatformHandler.getGenericDestination(platform);
    }
    command += ` -destination '${destination}'`;
    
    // Add test target/filter if provided
    if (testTarget) {
      command += ` -only-testing:${testTarget}`;
    }
    if (testFilter) {
      command += ` -only-testing:${testFilter}`;
    }
    
    // Disable parallel testing to avoid timeouts and multiple simulator instances
    command += ' -parallel-testing-enabled NO';
    
    // Add result bundle path
    command += ` -resultBundlePath "${resultBundlePath}"`;
    
    command += ' test';
    
    // Pipe through xcbeautify for clean output
    command = `set -o pipefail && ${command} 2>&1 | xcbeautify`;
    
    return command;
  }
}