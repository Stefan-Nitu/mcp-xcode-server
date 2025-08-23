import { z } from 'zod';
import { exec as nodeExec } from 'child_process';
import { promisify } from 'util';
import { createModuleLogger } from '../logger.js';

const logger = createModuleLogger('BootSimulatorTool');

// Type for the exec function
export type ExecFunction = typeof nodeExec;
export type ExecAsyncFunction = (command: string, options?: any) => Promise<{ stdout: string; stderr: string }>;

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
  private readonly execAsync: ExecAsyncFunction;

  constructor(execFunc?: ExecFunction) {
    // Use provided exec or default to Node's exec for testing
    const exec = execFunc || nodeExec;
    this.execAsync = promisify(exec) as unknown as ExecAsyncFunction;
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
    
    try {
      // Boot the simulator
      await this.execAsync(`xcrun simctl boot "${deviceId}"`);
      logger.info({ deviceId }, 'Simulator booted successfully');
    } catch (error: any) {
      // Check if simulator is already booted - that's OK
      if (error.message && error.message.includes('Unable to boot device in current state: Booted')) {
        logger.debug({ deviceId }, 'Simulator already in booted state');
        return {
          content: [
            {
              type: 'text',
              text: `Simulator already booted: ${deviceId}`
            }
          ]
        };
      }
      // Real error - throw it
      logger.error({ error, deviceId }, 'Failed to boot simulator');
      throw new Error(`Failed to boot simulator: ${error.message}`);
    }
    
    // Open Simulator.app to show the UI
    await this.ensureSimulatorAppOpen();
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully booted simulator: ${deviceId}`
        }
      ]
    };
  }

  /**
   * Ensure the Simulator app is open
   */
  private async ensureSimulatorAppOpen(): Promise<void> {
    try {
      // Check if Simulator.app is already running
      await this.execAsync('pgrep -x Simulator');
      logger.debug('Simulator.app is already running');
    } catch {
      // Simulator app not running, open it
      logger.debug('Opening Simulator.app');
      try {
        await this.execAsync('open -a Simulator');
      } catch (error: any) {
        // Log but don't fail - simulator will still work headless
        logger.warn({ error }, 'Could not open Simulator.app, continuing headless');
      }
    }
  }
}