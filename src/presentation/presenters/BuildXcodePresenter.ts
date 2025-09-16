import { BuildResult, BuildOutcome, OutputFormatterError } from '../../features/build/domain/BuildResult.js';
import { Platform } from '../../shared/domain/Platform.js';
import { ErrorFormatter } from '../formatters/ErrorFormatter.js';
import { MCPResponse } from '../interfaces/MCPResponse.js';

/**
 * Presenter for build results
 * 
 * Single Responsibility: Format BuildResult for MCP display
 * - Success formatting
 * - Failure formatting with errors/warnings
 * - Log path information
 */

export class BuildXcodePresenter {
  private readonly maxErrorsToShow = 50;
  private readonly maxWarningsToShow = 20;
  
  present(result: BuildResult, metadata: {
    scheme: string;
    platform: Platform;
    configuration: string;
    showWarningDetails?: boolean;
  }): MCPResponse {
    if (result.outcome === BuildOutcome.Succeeded) {
      return this.presentSuccess(result, metadata);
    }
    return this.presentFailure(result, metadata);
  }
  
  private presentSuccess(
    result: BuildResult,
    metadata: { scheme: string; platform: Platform; configuration: string; showWarningDetails?: boolean }
  ): MCPResponse {
    const warnings = BuildResult.getWarnings(result);
    
    let text = `✅ Build succeeded: ${metadata.scheme}

Platform: ${metadata.platform}
Configuration: ${metadata.configuration}`;

    // Show warning count if there are any
    if (warnings.length > 0) {
      text += `\nWarnings: ${warnings.length}`;
      
      // Show warning details if requested
      if (metadata.showWarningDetails) {
        text += '\n\n⚠️  Warnings:';
        const warningsToShow = Math.min(warnings.length, this.maxWarningsToShow);
        warnings.slice(0, warningsToShow).forEach(warning => {
          text += `\n  • ${this.formatIssue(warning)}`;
        });
        if (warnings.length > this.maxWarningsToShow) {
          text += `\n  ... and ${warnings.length - this.maxWarningsToShow} more warnings`;
        }
      }
    }

    text += `\nApp path: ${result.diagnostics.appPath || 'N/A'}${result.diagnostics.logPath ? `

📁 Full logs saved to: ${result.diagnostics.logPath}` : ''}`;
    
    return {
      content: [{ type: 'text', text }]
    };
  }
  
  private presentFailure(
    result: BuildResult,
    metadata: { scheme: string; platform: Platform; configuration: string; showWarningDetails?: boolean }
  ): MCPResponse {
    // Check if this is a dependency/tool error (not an actual build failure)
    if (result.diagnostics.error && result.diagnostics.error instanceof OutputFormatterError) {
      // Tool dependency missing - show only that error
      const text = `❌ ${ErrorFormatter.format(result.diagnostics.error)}`;
      return {
        content: [{ type: 'text', text }]
      };
    }
    
    const errors = BuildResult.getErrors(result);
    const warnings = BuildResult.getWarnings(result);
    
    let text = `❌ Build failed: ${metadata.scheme}\n`;
    text += `Platform: ${metadata.platform}\n`;
    text += `Configuration: ${metadata.configuration}\n`;
    
    // Check for other errors in diagnostics
    if (result.diagnostics.error) {
      text += `\n❌ ${ErrorFormatter.format(result.diagnostics.error)}\n`;
    }
    
    if (errors.length > 0) {
      text += `\n❌ Errors (${errors.length}):\n`;
      // Show up to maxErrorsToShow errors
      const errorsToShow = Math.min(errors.length, this.maxErrorsToShow);
      errors.slice(0, errorsToShow).forEach(error => {
        text += `  • ${this.formatIssue(error)}\n`;
      });
      if (errors.length > this.maxErrorsToShow) {
        text += `  ... and ${errors.length - this.maxErrorsToShow} more errors\n`;
      }
    }
    
    // Always show warning count if there are warnings
    if (warnings.length > 0) {
      if (metadata.showWarningDetails) {
        // Show detailed warnings
        text += `\n⚠️ Warnings (${warnings.length}):\n`;
        const warningsToShow = Math.min(warnings.length, this.maxWarningsToShow);
        warnings.slice(0, warningsToShow).forEach(warning => {
          text += `  • ${this.formatIssue(warning)}\n`;
        });
        if (warnings.length > this.maxWarningsToShow) {
          text += `  ... and ${warnings.length - this.maxWarningsToShow} more warnings\n`;
        }
      } else {
        // Just show count
        text += `\n⚠️ Warnings: ${warnings.length}\n`;
      }
    }
    
    if (result.diagnostics.logPath) {
      text += `\n📁 Full logs saved to: ${result.diagnostics.logPath}\n`;
    }
    
    return {
      content: [{ type: 'text', text }]
    };
  }
  
  private formatIssue(issue: any): string {
    if (issue.file && issue.line) {
      if (issue.column) {
        return `${issue.file}:${issue.line}:${issue.column}: ${issue.message}`;
      }
      return `${issue.file}:${issue.line}: ${issue.message}`;
    }
    return issue.message;
  }
  
  presentError(error: Error): MCPResponse {
    const message = ErrorFormatter.format(error);
    return {
      content: [{ 
        type: 'text', 
        text: `❌ ${message}` 
      }]
    };
  }
}