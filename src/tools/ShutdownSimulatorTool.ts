import { z } from 'zod';
import { SimulatorManager } from '../simulatorManager.js';
import { createModuleLogger } from '../logger.js';

const logger = createModuleLogger('ShutdownSimulatorTool');

// Validation schema
export const shutdownSimulatorSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required')
});

export type ShutdownSimulatorArgs = z.infer<typeof shutdownSimulatorSchema>;

// Interface for testing
export interface IShutdownSimulatorTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class ShutdownSimulatorTool implements IShutdownSimulatorTool {
  constructor(
    private simulatorManager = SimulatorManager
  ) {}

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
    
    await this.simulatorManager.shutdownSimulator(deviceId);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully shutdown simulator: ${deviceId}`
        }
      ]
    };
  }
}