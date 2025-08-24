import { z } from 'zod';
import { Devices } from '../utils/devices/Devices.js';
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
  private devices: Devices;

  constructor(devices?: Devices) {
    this.devices = devices || new Devices();
  }

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
    
    let device;
    try {
      if (deviceId) {
        device = await this.devices.find(deviceId);
        if (!device) {
          throw new Error(`Device not found: ${deviceId}`);
        }
      } else {
        // Use booted device if no device specified
        device = await this.devices.getBooted();
        if (!device) {
          throw new Error('No booted simulator found. Please boot a simulator first or specify a device ID.');
        }
      }
      
      await device.install(appPath);
      logger.info({ appPath, deviceId: device.id }, 'App installed successfully');
    } catch (error: any) {
      logger.error({ error: error.message, appPath, deviceId }, 'Failed to install app');
      throw error;
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully installed app: ${appPath} on ${device.name}`
        }
      ]
    };
  }
}