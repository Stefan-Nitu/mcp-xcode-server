import { z } from 'zod';
import { Platform } from '../../types.js';
import { createModuleLogger } from '../../logger.js';
import { safePathSchema, platformSchema, configurationSchema } from '../validators.js';
import { PlatformHandler } from '../../infrastructure/utilities/PlatformHandler.js';
import { Devices } from '../../utils/devices/Devices.js';

// Application layer
import { BuildProjectUseCase } from '../../application/use-cases/BuildProjectUseCase.js';

// Domain
import { BuildRequest } from '../../domain/value-objects/BuildRequest.js';

// Infrastructure adapters
import { XcodePlatformValidator } from '../../infrastructure/adapters/XcodePlatformValidator.js';
import { XcodeBuildCommandBuilder } from '../../infrastructure/adapters/XcodeBuildCommandBuilder.js';
import { ShellCommandExecutor } from '../../infrastructure/adapters/ShellCommandExecutor.js';
import { BuildArtifactLocator } from '../../infrastructure/adapters/BuildArtifactLocator.js';
import { ConfigProvider } from '../../infrastructure/adapters/ConfigProvider.js';
import { XcbeautifyOutputParser } from '../../infrastructure/adapters/XcbeautifyOutputParser.js';
import { LogManagerInstance } from '../../utils/LogManagerInstance.js';

const logger = createModuleLogger('BuildXcodeTool');

export const buildXcodeSchema = z.object({
  projectPath: safePathSchema,
  scheme: z.string({ required_error: 'Scheme is required' }).min(1, 'Scheme cannot be empty'),
  platform: platformSchema.optional().default(Platform.iOS),
  deviceId: z.string().optional(),
  configuration: configurationSchema,
  derivedDataPath: z.string().optional()
});

export type BuildXcodeArgs = z.infer<typeof buildXcodeSchema>;

/**
 * MCP Tool: Build Xcode projects and workspaces
 * Interface Adapter in Clean Architecture - adapts MCP interface to use case
 */
export class BuildXcodeTool {
  private buildUseCase: BuildProjectUseCase;
  private devices: Devices;

  constructor(
    devices?: Devices,
    buildUseCase?: BuildProjectUseCase
  ) {
    this.devices = devices || new Devices();
    
    // Dependency injection or create default
    this.buildUseCase = buildUseCase || new BuildProjectUseCase(
      new XcodePlatformValidator(),
      new XcodeBuildCommandBuilder(),
      new ShellCommandExecutor(),
      new BuildArtifactLocator(),
      new LogManagerInstance(),
      new ConfigProvider(),  // Now injected!
      new XcbeautifyOutputParser()  // Now injected!
    );
  }

  getToolDefinition() {
    return {
      name: 'build_xcode',
      description: 'Build an Xcode project or workspace',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to .xcodeproj or .xcworkspace file'
          },
          scheme: {
            type: 'string',
            description: 'Xcode scheme to build'
          },
          platform: {
            type: 'string',
            description: 'Target platform',
            enum: ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS'],
            default: 'iOS'
          },
          deviceId: {
            type: 'string',
            description: 'Device UDID or name (optional, uses generic device if not specified)'
          },
          configuration: {
            type: 'string',
            description: 'Build configuration (e.g., Debug, Release, Beta, Staging)',
            default: 'Debug'
          }
        },
        required: ['projectPath', 'scheme']
      }
    };
  }

  async execute(args: any) {
    // 1. Validate input using Zod schema
    const validated = buildXcodeSchema.parse(args);
    const { projectPath, scheme, platform, deviceId, configuration } = validated;
    
    logger.info({ projectPath, scheme, platform, configuration }, 'Building Xcode project');
    
    try {
      // 2. Handle device booting if needed (MCP-specific logic)
      let bootedDeviceId = deviceId;
      if (deviceId && PlatformHandler.needsSimulator(platform)) {
        const device = await this.devices.find(deviceId);
        if (!device) {
          throw new Error(`Device not found: ${deviceId}`);
        }
        await device.ensureBooted();
        bootedDeviceId = device.id;
      }
      
      // 3. Create domain object at the border (parsing happens here)
      const request = new BuildRequest({
        projectPath,
        scheme,
        configuration,
        platform,
        deviceId: bootedDeviceId,
        derivedDataPath: validated.derivedDataPath  // Pass through if provided
      });
      
      // 4. If no derivedDataPath provided, get from config and update request
      let finalRequest = request;
      if (!validated.derivedDataPath) {
        const configProvider = new ConfigProvider(projectPath);
        const derivedDataPath = configProvider.getDerivedDataPath();
        finalRequest = request.withDerivedDataPath(derivedDataPath);
      }
      
      // 5. Execute use case with validated domain object
      const result = await this.buildUseCase.execute(finalRequest);
      
      // 5. Format response for MCP
      return {
        content: [
          {
            type: 'text',
            text: `✅ Build succeeded: ${scheme}

Platform: ${platform}
Configuration: ${configuration}
App path: ${result.appPath || 'N/A'}${result.logPath ? `

📁 Full logs saved to: ${result.logPath}` : ''}`
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error, projectPath, scheme, platform }, 'Build failed');
      
      // Handle domain errors
      if (error.buildResult) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Build failed: ${error.message}${error.buildResult.logPath ? `

📁 Full logs saved to: ${error.buildResult.logPath}` : ''}`
            }
          ]
        };
      }
      
      // Handle other errors
      return {
        content: [
          {
            type: 'text',
            text: `❌ Build failed: ${error.message}`
          }
        ]
      };
    }
  }
}