import { execAsync } from '../../utils.js';
import { createModuleLogger } from '../../logger.js';
import { Platform } from '../../types.js';
import path from 'path';

const logger = createModuleLogger('XcodeInfo');

/**
 * Queries information about Xcode projects
 */
export class XcodeInfo {
  /**
   * Get list of schemes in a project
   */
  async getSchemes(
    projectPath: string,
    isWorkspace: boolean
  ): Promise<string[]> {
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    const command = `xcodebuild -list -json ${projectFlag} "${projectPath}"`;
    
    logger.debug({ command }, 'List schemes command');
    
    try {
      const { stdout } = await execAsync(command);
      const data = JSON.parse(stdout);
      
      // Get schemes from the appropriate property
      let schemes: string[] = [];
      if (isWorkspace && data.workspace?.schemes) {
        schemes = data.workspace.schemes;
      } else if (!isWorkspace && data.project?.schemes) {
        schemes = data.project.schemes;
      }
      
      logger.debug({ projectPath, schemes }, 'Found schemes');
      return schemes;
    } catch (error: any) {
      logger.error({ error: error.message, projectPath }, 'Failed to get schemes');
      throw new Error(`Failed to get schemes: ${error.message}`);
    }
  }
  
  /**
   * Get list of targets in a project
   */
  async getTargets(
    projectPath: string,
    isWorkspace: boolean
  ): Promise<string[]> {
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    const command = `xcodebuild -list -json ${projectFlag} "${projectPath}"`;
    
    logger.debug({ command }, 'List targets command');
    
    try {
      const { stdout } = await execAsync(command);
      const data = JSON.parse(stdout);
      
      // Get targets from the project (even for workspaces, targets come from projects)
      const targets = data.project?.targets || [];
      
      logger.debug({ projectPath, targets }, 'Found targets');
      return targets;
    } catch (error: any) {
      logger.error({ error: error.message, projectPath }, 'Failed to get targets');
      throw new Error(`Failed to get targets: ${error.message}`);
    }
  }
  
  /**
   * Get build settings for a scheme
   */
  async getBuildSettings(
    projectPath: string,
    isWorkspace: boolean,
    scheme: string,
    configuration?: string,
    platform?: Platform
  ): Promise<any> {
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    let command = `xcodebuild -showBuildSettings ${projectFlag} "${projectPath}"`;
    command += ` -scheme "${scheme}"`;
    
    if (configuration) {
      command += ` -configuration "${configuration}"`;
    }
    
    if (platform) {
      // Add a generic destination for the platform to get appropriate settings
      const { PlatformHandler } = await import('../../platformHandler.js');
      const destination = PlatformHandler.getGenericDestination(platform);
      command += ` -destination '${destination}'`;
    }
    
    command += ' -json';
    
    logger.debug({ command }, 'Get build settings command');
    
    try {
      const { stdout } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024
      });
      
      const settings = JSON.parse(stdout);
      logger.debug({ projectPath, scheme }, 'Got build settings');
      
      return settings;
    } catch (error: any) {
      logger.error({ error: error.message, projectPath, scheme }, 'Failed to get build settings');
      throw new Error(`Failed to get build settings: ${error.message}`);
    }
  }
  
  /**
   * Get comprehensive project information
   */
  async getProjectInfo(
    projectPath: string,
    isWorkspace: boolean
  ): Promise<{
    name: string;
    schemes: string[];
    targets: string[];
    configurations: string[];
  }> {
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    const command = `xcodebuild -list -json ${projectFlag} "${projectPath}"`;
    
    logger.debug({ command }, 'Get project info command');
    
    try {
      const { stdout } = await execAsync(command);
      const data = JSON.parse(stdout);
      
      // Extract info based on project type
      let info;
      if (isWorkspace) {
        info = {
          name: data.workspace?.name || path.basename(projectPath, '.xcworkspace'),
          schemes: data.workspace?.schemes || [],
          targets: data.project?.targets || [],
          configurations: data.project?.configurations || []
        };
      } else {
        info = {
          name: data.project?.name || path.basename(projectPath, '.xcodeproj'),
          schemes: data.project?.schemes || [],
          targets: data.project?.targets || [],
          configurations: data.project?.configurations || []
        };
      }
      
      logger.debug({ projectPath, info }, 'Got project info');
      return info;
    } catch (error: any) {
      logger.error({ error: error.message, projectPath }, 'Failed to get project info');
      throw new Error(`Failed to get project info: ${error.message}`);
    }
  }
}