import { z } from 'zod';
import { SimulatorManager } from '../simulatorManager.js';
import { createModuleLogger } from '../logger.js';
import { safePathSchema } from './validators.js';

const logger = createModuleLogger('InstallAppTool');

// Validation schema
export const installAppSchema = z.object({
  appPath: safePathSchema,
  deviceId: z.string().optional()
});

export type InstallAppArgs = z.infer<typeof installAppSchema>;

// Interface for testing
export interface IInstallAppTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class InstallAppTool implements IInstallAppTool {
  constructor(
    private simulatorManager = SimulatorManager
  ) {}

  getToolDefinition() {
    return {
      name: 'install_app',
      description: 'Install an app on the simulator',
      inputSchema: {
        type: 'object',
        properties: {
          appPath: {
            type: 'string',
            description: 'Path to the .app bundle'
          },
          deviceId: {
            type: 'string',
            description: 'Device UDID or name of the simulator (optional, uses booted device if not specified)'
          }
        },
        required: ['appPath']
      }
    };
  }

  async execute(args: any) {
    const validated = installAppSchema.parse(args);
    const { appPath, deviceId } = validated;
    
    logger.info({ appPath, deviceId }, 'Installing app');
    
    await this.simulatorManager.installApp(appPath, deviceId);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully installed app: ${appPath}`
        }
      ]
    };
  }
}