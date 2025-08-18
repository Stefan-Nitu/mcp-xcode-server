import { z } from 'zod';
import { SimulatorManager } from '../simulatorManager.js';
import { createModuleLogger } from '../logger.js';

const logger = createModuleLogger('BootSimulatorTool');

// Validation schema
export const bootSimulatorSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required')
});

export type BootSimulatorArgs = z.infer<typeof bootSimulatorSchema>;

// Interface for testing
export interface IBootSimulatorTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class BootSimulatorTool implements IBootSimulatorTool {
  constructor(
    private simulatorManager = SimulatorManager
  ) {}

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
    
    await this.simulatorManager.bootSimulator(deviceId);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully booted simulator: ${deviceId}`
        }
      ]
    };
  }
}