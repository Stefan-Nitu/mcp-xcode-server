import { MCPController } from '../interfaces/MCPController.js';
import { MCPResponse } from '../interfaces/MCPResponse.js';
import { IDependencyChecker } from '../interfaces/IDependencyChecker.js';

/**
 * Decorator that checks dependencies before executing the controller
 *
 * Follows the Decorator pattern to add dependency checking behavior
 * without modifying the original controller
 */
export class DependencyCheckingDecorator implements MCPController {
  // Delegate properties to decoratee
  get name(): string { return this.decoratee.name; }
  get description(): string { return this.decoratee.description; }
  get inputSchema(): object { return this.decoratee.inputSchema; }

  constructor(
    private readonly decoratee: MCPController,
    private readonly requiredDependencies: string[],
    private readonly dependencyChecker: IDependencyChecker
  ) {}

  async execute(args: unknown): Promise<MCPResponse> {
    // Check dependencies first
    const missing = await this.dependencyChecker.check(this.requiredDependencies);

    if (missing.length > 0) {
      // Dependencies missing - return error without executing
      let text = '❌ Missing required dependencies:\n';
      for (const dep of missing) {
        text += `\n  • ${dep.name}`;
        if (dep.installCommand) {
          text += `: ${dep.installCommand}`;
        }
      }

      return {
        content: [{ type: 'text', text }]
      };
    }

    // All dependencies available - delegate to actual controller
    return this.decoratee.execute(args);
  }

  getToolDefinition() {
    // Delegate to decoratee
    return this.decoratee.getToolDefinition();
  }
}