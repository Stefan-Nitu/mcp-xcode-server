import { z } from 'zod';
import { Devices } from '../utils/devices/Devices.js';
import { createModuleLogger } from '../logger.js';

const logger = createModuleLogger('ViewSimulatorScreenTool');

// Validation schema
export const viewSimulatorScreenSchema = z.object({
  deviceId: z.string().optional()
});

export type ViewSimulatorScreenArgs = z.infer<typeof viewSimulatorScreenSchema>;

// Interface for testing
export interface IViewSimulatorScreenTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class ViewSimulatorScreenTool implements IViewSimulatorScreenTool {
  private devices: Devices;
  
  constructor(devices?: Devices) {
    this.devices = devices || new Devices();
  }

  getToolDefinition() {
    return {
      name: 'view_simulator_screen',
      description: 'Capture and view the current simulator screen (returns image data)',
      inputSchema: {
        type: 'object',
        properties: {
          deviceId: {
            type: 'string',
            description: 'Device UDID or name of the simulator (optional, uses booted device if not specified)'
          }
        }
      }
    };
  }

  async execute(args: any) {
    const validated = viewSimulatorScreenSchema.parse(args);
    const { deviceId } = validated;
    
    logger.debug({ deviceId }, 'Capturing simulator screen');
    
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
    
    const { base64, mimeType } = await device.screenshotData();
    
    return {
      content: [
        {
          type: 'image',
          data: base64,
          mimeType
        }
      ]
    };
  }
}