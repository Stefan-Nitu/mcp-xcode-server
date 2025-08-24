import { z } from 'zod';
import { Devices } from '../utils/devices/Devices.js';
import { createModuleLogger } from '../logger.js';

const logger = createModuleLogger('ShutdownSimulatorTool');

// Validation schema
export const shutdownSimulatorSchema = z.object({
  deviceId: z.string({ required_error: 'Device ID is required' }).min(1, 'Device ID is required')
});

export type ShutdownSimulatorArgs = z.infer<typeof shutdownSimulatorSchema>;

// Interface for testing
export interface IShutdownSimulatorTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class ShutdownSimulatorTool implements IShutdownSimulatorTool {
  private devices: Devices;

  constructor(devices?: Devices) {
    this.devices = devices || new Devices();
  }

  getToolDefinition() {
    return {
      name: 'shutdown_simulator',
      description: 'Shutdown a simulator',
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: {
            type: 'string',
            description: 'Device UDID or name of the simulator to shutdown'
          }
        },
        required: ['deviceId']
      }
    };
  }

  async execute(args: any) {
    const validated = shutdownSimulatorSchema.parse(args);
    const { deviceId } = validated;
    
    logger.info({ deviceId }, 'Shutting down simulator');
    
    const device = await this.devices.find(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }
    
    await device.shutdown();
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully shutdown simulator: ${device.name} (${device.id})`
        }
      ]
    };
  }
}