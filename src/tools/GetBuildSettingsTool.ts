import { z } from 'zod';
import { Platform } from '../types.js';
import { createModuleLogger } from '../logger.js';
import { safePathSchema, platformSchema, configurationSchema } from './validators.js';
import { XcodeInfo } from '../utils/projects/XcodeInfo.js';
import { existsSync } from 'fs';

const logger = createModuleLogger('GetBuildSettingsTool');

// Validation schema
export const getBuildSettingsSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string(),
  configuration: configurationSchema.optional(),
  platform: platformSchema.optional()
});

export type GetBuildSettingsArgs = z.infer<typeof getBuildSettingsSchema>;

// Interface for testing
export interface IGetBuildSettingsTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class GetBuildSettingsTool implements IGetBuildSettingsTool {
  private xcodeInfo: XcodeInfo;
  
  constructor(xcodeInfo?: XcodeInfo) {
    this.xcodeInfo = xcodeInfo || new XcodeInfo();
  }

  getToolDefinition() {
    return {
      name: 'get_build_settings',
      description: 'Get build settings for a specific scheme in an Xcode project',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to the Xcode project or workspace'
          },
          scheme: {
            type: 'string',
            description: 'Xcode scheme to get settings for'
          },
          configuration: {
            type: 'string',
            description: 'Build configuration (Debug/Release)',
            enum: ['Debug', 'Release']
          },
          platform: {
            type: 'string',
            description: 'Target platform (iOS, macOS, tvOS, watchOS, visionOS)',
            enum: ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS']
          }
        },
        required: ['projectPath', 'scheme']
      }
    };
  }

  async execute(args: any) {
    const validated = getBuildSettingsSchema.parse(args);
    const { projectPath, scheme, configuration, platform } = validated;
    
    logger.info({ projectPath, scheme, configuration, platform }, 'Getting build settings');
    
    try {
      // Check if project exists
      if (!existsSync(projectPath)) {
        throw new Error(`Project path does not exist: ${projectPath}`);
      }
      
      // Determine project type
      const isWorkspace = projectPath.endsWith('.xcworkspace');
      
      // Get build settings using XcodeInfo
      const settingsResult = await this.xcodeInfo.getBuildSettings(
        projectPath,
        isWorkspace,
        scheme,
        configuration,
        platform
      );
      
      // The result should contain the build settings
      const settings = settingsResult[0]?.buildSettings || settingsResult;
      
      if (!settings || Object.keys(settings).length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No build settings found'
            }
          ]
        };
      }
      
      // Extract key settings for summary
      const keySetting = {
        PRODUCT_NAME: settings.PRODUCT_NAME,
        PRODUCT_BUNDLE_IDENTIFIER: settings.PRODUCT_BUNDLE_IDENTIFIER,
        SWIFT_VERSION: settings.SWIFT_VERSION,
        IPHONEOS_DEPLOYMENT_TARGET: settings.IPHONEOS_DEPLOYMENT_TARGET,
        MACOSX_DEPLOYMENT_TARGET: settings.MACOSX_DEPLOYMENT_TARGET,
        ARCHS: settings.ARCHS,
        CONFIGURATION: settings.CONFIGURATION,
        SDK_NAME: settings.SDK_NAME
      };
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              projectPath,
              scheme,
              configuration: configuration || settings.CONFIGURATION,
              platform: platform || 'Derived from SDK',
              keySettings: keySetting,
              allSettings: settings,
              totalSettings: Object.keys(settings).length
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error: error.message, projectPath }, 'Failed to get build settings');
      
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get build settings: ${error.message}`
          }
        ]
      };
    }
  }
}