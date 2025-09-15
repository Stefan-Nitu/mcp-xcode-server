import { ListSimulatorsUseCase } from '../../application/use-cases/ListSimulatorsUseCase.js';
import { ListSimulatorsRequest } from '../../domain/value-objects/ListSimulatorsRequest.js';
import { Platform } from '../../domain/value-objects/Platform.js';
import { SimulatorState } from '../../domain/value-objects/SimulatorState.js';
import { ErrorFormatter } from '../formatters/ErrorFormatter.js';
import { MCPController } from '../interfaces/MCPController.js';

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
    try {
      // Cast to expected shape
      const input = args as { platform?: string; state?: string };

      // Use the new validation functions
      const platform = Platform.parseOptional(input.platform);
      const state = SimulatorState.parseOptional(input.state);

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
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ ${ErrorFormatter.format(error as Error)}`
        }]
      };
    }
  }

}