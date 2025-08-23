import { z } from 'zod';
import { exec as nodeExec } from 'child_process';
import { promisify } from 'util';
import { Platform, SimulatorDevice } from '../types.js';
import { createModuleLogger } from '../logger.js';

const logger = createModuleLogger('ListSimulatorsTool');

// Type for the exec function
export type ExecFunction = typeof nodeExec;
export type ExecAsyncFunction = (command: string, options?: any) => Promise<{ stdout: string; stderr: string }>;

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
  private readonly execAsync: ExecAsyncFunction;

  constructor(execFunc?: ExecFunction) {
    // Use provided exec or default to Node's exec for testing
    const exec = execFunc || nodeExec;
    this.execAsync = promisify(exec) as unknown as ExecAsyncFunction;
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
    
    const devices = await this.listSimulators(showAll, platform);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(devices, null, 2)
        }
      ]
    };
  }

  /**
   * List all available simulators, optionally filtered by platform
   */
  private async listSimulators(showAll = false, platform?: Platform): Promise<SimulatorDevice[]> {
    try {
      const { stdout } = await this.execAsync('xcrun simctl list devices --json');
      const data = JSON.parse(stdout);
      
      const devices: SimulatorDevice[] = [];
      for (const [runtime, deviceList] of Object.entries(data.devices)) {
        // Filter by platform if specified
        if (platform) {
          const runtimeLower = runtime.toLowerCase();
          const platformLower = platform.toLowerCase();
          
          // Skip if runtime doesn't match platform
          if (!runtimeLower.includes(platformLower)) {
            continue;
          }
        }

        for (const device of deviceList as any[]) {
          if (!showAll && !device.isAvailable) {
            continue;
          }
          devices.push({
            udid: device.udid,
            name: device.name,
            state: device.state,
            deviceTypeIdentifier: device.deviceTypeIdentifier,
            runtime: runtime.replace('com.apple.CoreSimulator.SimRuntime.', ''),
            isAvailable: device.isAvailable
          });
        }
      }

      return devices;
    } catch (error) {
      logger.error({ error }, 'Failed to list simulators');
      throw new Error(`Failed to list simulators: ${error}`);
    }
  }
}