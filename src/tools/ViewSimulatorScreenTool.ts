import { z } from 'zod';
import { SimulatorManager } from '../simulatorManager.js';
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
  constructor(
    private simulatorManager = SimulatorManager
  ) {}

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
    
    const { base64, mimeType } = await this.simulatorManager.captureScreenshotData(deviceId);
    
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