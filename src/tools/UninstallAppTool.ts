import { z } from 'zod';
import { SimulatorManager } from '../simulatorManager.js';
import { createModuleLogger } from '../logger.js';

const logger = createModuleLogger('UninstallAppTool');

// Validation schema
export const uninstallAppSchema = z.object({
  bundleId: z.string()
    .regex(/^[a-zA-Z0-9.-]+$/, { message: 'Invalid bundle ID format' }),
  deviceId: z.string().optional()
});

export type UninstallAppArgs = z.infer<typeof uninstallAppSchema>;

// Interface for testing
export interface IUninstallAppTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class UninstallAppTool implements IUninstallAppTool {
  constructor(
    private simulatorManager = SimulatorManager
  ) {}

  getToolDefinition() {
    return {
      name: 'uninstall_app',
      description: 'Uninstall an app from the simulator',
      inputSchema: {
        type: 'object',
        properties: {
          bundleId: {
            type: 'string',
            description: 'Bundle identifier of the app to uninstall'
          },
          deviceId: {
            type: 'string',
            description: 'Device UDID or name of the simulator (optional, uses booted device if not specified)'
          }
        },
        required: ['bundleId']
      }
    };
  }

  async execute(args: any) {
    const validated = uninstallAppSchema.parse(args);
    const { bundleId, deviceId } = validated;
    
    logger.info({ bundleId, deviceId }, 'Uninstalling app');
    
    await this.simulatorManager.uninstallApp(bundleId, deviceId);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully uninstalled app: ${bundleId}`
        }
      ]
    };
  }
}