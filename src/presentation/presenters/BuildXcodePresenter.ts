import { BuildResult } from '../domain/entities/BuildResult.js';

/**
 * Presenter for build results
 * 
 * Single Responsibility: Format BuildResult for MCP display
 * - Success formatting
 * - Failure formatting with errors/warnings
 * - Log path information
 */

export interface MCPResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export class BuildXcodePresenter {
  
  present(result: BuildResult, metadata: {
    scheme: string;
    platform: string;
    configuration: string;
  }): MCPResponse {
    if (result.success) {
      return this.presentSuccess(result, metadata);
    }
    return this.presentFailure(result, metadata);
  }
  
  private presentSuccess(
    result: BuildResult,
    metadata: { scheme: string; platform: string; configuration: string }
  ): MCPResponse {
    const text = `✅ Build succeeded: ${metadata.scheme}

Platform: ${metadata.platform}
Configuration: ${metadata.configuration}
App path: ${result.appPath || 'N/A'}${result.logPath ? `

📁 Full logs saved to: ${result.logPath}` : ''}`;
    
    return {
      content: [{ type: 'text', text }]
    };
  }
  
  private presentFailure(
    result: BuildResult,
    metadata: { scheme: string; platform: string; configuration: string }
  ): MCPResponse {
    const errors = result.getErrors();
    const warnings = result.getWarnings();
    
    let text = `❌ Build failed: ${metadata.scheme}\n`;
    text += `Platform: ${metadata.platform}\n`;
    text += `Configuration: ${metadata.configuration}\n`;
    
    if (errors.length > 0) {
      text += `\n❌ Errors (${errors.length}):\n`;
      // Show first 5 errors
      errors.slice(0, 5).forEach(error => {
        text += `  • ${this.formatIssue(error)}\n`;
      });
      if (errors.length > 5) {
        text += `  ... and ${errors.length - 5} more errors\n`;
      }
    }
    
    if (warnings.length > 0) {
      text += `\n⚠️ Warnings (${warnings.length}):\n`;
      // Show first 3 warnings
      warnings.slice(0, 3).forEach(warning => {
        text += `  • ${this.formatIssue(warning)}\n`;
      });
      if (warnings.length > 3) {
        text += `  ... and ${warnings.length - 3} more warnings\n`;
      }
    }
    
    if (result.logPath) {
      text += `\n📁 Full logs saved to: ${result.logPath}`;
    }
    
    return {
      content: [{ type: 'text', text }]
    };
  }
  
  private formatIssue(issue: any): string {
    // Use toString() if available, otherwise format manually
    if (issue.toString) {
      return issue.toString();
    }
    
    // Fallback formatting
    if (issue.file && issue.line) {
      return `${issue.file}:${issue.line}: ${issue.message}`;
    }
    return issue.message || 'Unknown issue';
  }
  
  presentError(error: Error): MCPResponse {
    return {
      content: [{
        type: 'text',
        text: `❌ Build error: ${error.message}`
      }]
    };
  }
}