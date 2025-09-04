/**
 * MCP Framework Response Model
 * 
 * Defines the response format expected by the MCP (Model Context Protocol) framework.
 * This is a presentation layer contract for formatting output to the MCP client.
 */
export interface MCPResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}