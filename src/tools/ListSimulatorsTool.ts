import { z } from 'zod';
import { Platform } from '../types.js';
import { SimulatorInfo } from '../utils/devices/SimulatorInfo.js';
import { createModuleLogger } from '../logger.js';

const logger = createModuleLogger('ListSimulatorsTool');

// Validation schema
export const listSimulatorsSchema = z.object({
  showAll: z.boolean().optional().default(false),
  platform: z.nativeEnum(Platform).optional()
});

export type ListSimulatorsArgs = z.infer<typeof listSimulatorsSchema>;

// Interface for testing
export interface IListSimulatorsTool {
  execute(args: any): Promise<any>;
  getToolDefinition(): any;
}

export class ListSimulatorsTool implements IListSimulatorsTool {
  // This tool is purely informational and creates SimulatorInfo instances as needed
  // Unlike operational tools, it doesn't maintain a Devices instance
  
  constructor() {
    // No dependencies - SimulatorInfo is created on demand in execute()
  }

  getToolDefinition() {
    return {
      name: 'list_simulators',
      description: 'List all available Apple simulators',
      inputSchema: {
        type: 'object',
        properties: {
          showAll: {
            type: 'boolean',
            description: 'Show all simulators including unavailable ones',
            default: false
          },
          platform: {
            type: 'string',
            description: 'Filter by platform (iOS, tvOS, watchOS, visionOS)',
            enum: ['iOS', 'tvOS', 'watchOS', 'visionOS']
          }
        }
      }
    };
  }

  async execute(args: any) {
    const validated = listSimulatorsSchema.parse(args);
    const { showAll, platform } = validated;
    
    logger.debug({ showAll, platform }, 'Listing simulators');
    
    try {
      // ListSimulatorsTool is informational, so we use SimulatorInfo directly
      // rather than Devices which returns operational SimulatorDevice instances
      const simulatorInfo = new SimulatorInfo();
      const devices = await simulatorInfo.list(platform, showAll);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(devices, null, 2)
          }
        ]
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to list simulators');
      throw new Error(`Failed to list simulators: ${error.message}`);
    }
  }
}