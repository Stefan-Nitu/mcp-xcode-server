import { z } from 'zod';
import { Devices } from '../utils/devices/Devices.js';
import { createModuleLogger } from '../logger.js';
import { timeIntervalSchema } from '../commonSchemas.js';

const logger = createModuleLogger('GetDeviceLogsTool');

// Validation schema
export const getDeviceLogsSchema = z.object({
  deviceId: z.string().optional(),
  predicate: z.string()
    .refine(
      (pred) => !pred.includes('`') && !pred.includes('$'),
      { message: 'Command injection patterns not allowed in predicate' }
    )
    .optional(),
  last: timeIntervalSchema
});

export type GetDeviceLogsArgs = z.infer<typeof getDeviceLogsSchema>;

// Interface for testing
export interface IGetDeviceLogsTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class GetDeviceLogsTool implements IGetDeviceLogsTool {
  private devices: Devices;

  constructor(devices?: Devices) {
    this.devices = devices || new Devices();
  }

  getToolDefinition() {
    return {
      name: 'get_device_logs',
      description: 'Get device logs from the simulator',
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: {
            type: 'string',
            description: 'Device UDID or name of the simulator (optional, uses booted device if not specified)'
          },
          predicate: {
            type: 'string',
            description: 'Log filter predicate (optional)'
          },
          last: {
            type: 'string',
            description: 'Time interval for logs (e.g., "1m", "5m", "1h")',
            default: '5m'
          }
        }
      }
    };
  }

  async execute(args: any) {
    const validated = getDeviceLogsSchema.parse(args);
    const { deviceId, predicate, last } = validated;
    
    logger.debug({ deviceId, predicate, last }, 'Getting device logs');
    
    let device;
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
    
    const logs = await device.logs(predicate, last);
    
    return {
      content: [
        {
          type: 'text',
          text: logs
        }
      ]
    };
  }
}