import { z } from 'zod';
import { ListSimulatorsUseCase } from '../../application/use-cases/ListSimulatorsUseCase.js';
import { ListSimulatorsRequest } from '../../domain/value-objects/ListSimulatorsRequest.js';
import { Platform } from '../../domain/value-objects/Platform.js';
import { SimulatorState } from '../../domain/value-objects/SimulatorState.js';
import { ErrorFormatter } from '../formatters/ErrorFormatter.js';
import { MCPController } from '../interfaces/MCPController.js';

const listSimulatorsSchema = z.object({
  platform: z.enum(['iOS', 'macOS', 'tvOS', 'watchOS', 'visionOS']).optional(),
  state: z.enum(['Booted', 'Booting', 'Shutdown', 'Shutting Down', 'Unknown']).optional()
});

type ListSimulatorsArgs = z.infer<typeof listSimulatorsSchema>;

/**
 * Controller for the list_simulators MCP tool
 *
 * Lists available simulators with optional filtering
 */
export class ListSimulatorsController implements MCPController {
  readonly name = 'list_simulators';
  readonly description = 'List available iOS simulators';

  constructor(
    private useCase: ListSimulatorsUseCase
  ) {}

  get inputSchema() {
    return {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string' as const,
          description: 'Filter by platform',
          enum: ['iOS', 'tvOS', 'watchOS', 'visionOS'] as const
        },
        state: {
          type: 'string' as const,
          description: 'Filter by simulator state',
          enum: ['Booted', 'Shutdown'] as const
        }
      },
      required: [] as const
    };
  }

  getToolDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema
    };
  }

  async execute(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    const validated = listSimulatorsSchema.parse(args);

    const platform = validated.platform ? Platform[validated.platform as keyof typeof Platform] : undefined;
    const state = validated.state ? this.mapStringToState(validated.state) : undefined;

    const request = ListSimulatorsRequest.create(platform, state);
    const result = await this.useCase.execute(request);

    if (!result.isSuccess) {
      return {
        content: [{
          type: 'text',
          text: `❌ ${ErrorFormatter.format(result.error!)}`
        }]
      };
    }

    if (result.count === 0) {
      return {
        content: [{
          type: 'text',
          text: '⚠️ No simulators found'
        }]
      };
    }

    const lines: string[] = [
      `✅ Found ${result.count} simulator${result.count === 1 ? '' : 's'}`,
      ''
    ];

    for (const simulator of result.simulators) {
      lines.push(`• ${simulator.name} (${simulator.udid}) - ${simulator.state} - ${simulator.runtime}`);
    }

    return {
      content: [{
        type: 'text',
        text: lines.join('\n')
      }]
    };
  }

  private mapStringToState(state: string): SimulatorState {
    switch (state) {
      case 'Booted': return SimulatorState.Booted;
      case 'Booting': return SimulatorState.Booting;
      case 'Shutdown': return SimulatorState.Shutdown;
      case 'Shutting Down': return SimulatorState.ShuttingDown;
      case 'Unknown': return SimulatorState.Unknown;
      default: return SimulatorState.Unknown;
    }
  }
}