import { z } from 'zod';
import { createModuleLogger } from '../../logger.js';
import { Devices } from '../../utils/devices/Devices.js';

const logger = createModuleLogger('BootSimulatorTool');

// Validation schema
export const bootSimulatorSchema = z.object({
  deviceId: z.string({ required_error: 'Device ID is required' }).min(1, 'Device ID is required')
});

export type BootSimulatorArgs = z.infer<typeof bootSimulatorSchema>;

// Interface for testing
export interface IBootSimulatorTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class BootSimulatorTool implements IBootSimulatorTool {
  private devices: Devices;

  constructor(devices?: Devices) {
    this.devices = devices || new Devices();
  }

  getToolDefinition() {
    return {
      name: 'boot_simulator',
      description: 'Boot a simulator',
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: {
            type: 'string',
            description: 'Device UDID or name of the simulator to boot'
          }
        },
        required: ['deviceId']
      }
    };
  }

  async execute(args: any) {
    const validated = bootSimulatorSchema.parse(args);
    const { deviceId } = validated;
    
    logger.info({ deviceId }, 'Booting simulator');
    
    // Find the device
    const device = await this.devices.find(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }
    
    try {
      // Boot the simulator
      await device.bootDevice();
      logger.info({ deviceId: device.id, name: device.name }, 'Simulator booted successfully');
    } catch (error: any) {
      // Check if simulator is already booted - that's OK
      if (error.message && error.message.includes('Unable to boot device in current state: Booted')) {
        logger.debug({ deviceId: device.id }, 'Simulator already in booted state');
        return {
          content: [
            {
              type: 'text',
              text: `Simulator already booted: ${device.name} (${device.id})`
            }
          ]
        };
      }
      // Real error - throw it
      logger.error({ error, deviceId: device.id }, 'Failed to boot simulator');
      throw error;
    }
    
    // Open Simulator.app to show the UI (handles test env)
    await device.open();
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully booted simulator: ${device.name} (${device.id})`
        }
      ]
    };
  }
}