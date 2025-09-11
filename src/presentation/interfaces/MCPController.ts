/**
 * Interface for MCP Tool Controllers
 * 
 * All MCP controllers must implement this interface to ensure
 * consistent tool definition and execution patterns
 */
export interface MCPController {
  /** MCP tool name (e.g., 'build_xcode', 'install_app') */
  readonly name: string;
  
  /** Human-readable description of what the tool does */
  readonly description: string;
  
  /** JSON Schema for input validation */
  readonly inputSchema: object;
  
  /**
   * Get the complete MCP tool definition
   * Used by the MCP server to register the tool
   */
  getToolDefinition(): {
    name: string;
    description: string;
    inputSchema: object;
  };
  
  /**
   * Execute the tool with given arguments
   * @param args - Unknown input that will be validated
   * @returns MCP-formatted response with content array
   */
  execute(args: unknown): Promise<{
    content: Array<{
      type: string;
      text: string;
    }>;
  }>;
}