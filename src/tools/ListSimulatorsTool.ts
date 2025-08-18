import { z } from 'zod';
import { SimulatorManager } from '../simulatorManager.js';
import { Platform } from '../types.js';
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
  constructor(
    private simulatorManager = SimulatorManager
  ) {}

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
            description: 'Filter by platform (iOS, macOS, tvOS, watchOS, visionOS)',
            enum: ['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS']
          }
        }
      }
    };
  }

  async execute(args: any) {
    const validated = listSimulatorsSchema.parse(args);
    const { showAll, platform } = validated;
    
    logger.debug({ showAll, platform }, 'Listing simulators');
    
    const devices = await this.simulatorManager.listSimulators(showAll, platform);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(devices, null, 2)
        }
      ]
    };
  }
}