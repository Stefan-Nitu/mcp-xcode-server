import { IOutputParser, ParsedOutput } from '../../application/ports/OutputParserPorts.js';
import { BuildIssue } from '../../domain/value-objects/BuildIssue.js';

/**
 * Infrastructure adapter for parsing xcbeautify output
 * 
 * Responsibilities:
 * - Parse xcbeautify output (❌ for errors, ⚠️ for warnings)
 * - Extract structured BuildIssue objects
 * - Handle multi-line output (code context lines)
 * - Deduplicate identical issues
 * - NO formatting, NO adding messages
 */
export class XcbeautifyOutputParserAdapter implements IOutputParser {
  
  parseBuildOutput(output: string): ParsedOutput {
    const lines = output.split('\n');
    const issueMap = new Map<string, BuildIssue>();
    
    for (const line of lines) {
      // Skip empty lines
      if (!line.trim()) continue;
      
      // Skip xcbeautify header
      if (line.includes('xcbeautify') || 
          line.startsWith('---') || 
          line.startsWith('Version:')) {
        continue;
      }
      
      // Parse errors (❌)
      if (line.includes('❌')) {
        const issue = this.parseIssueLine(line, 'error');
        if (issue) {
          issueMap.set(issue.toKey(), issue);
        }
      }
      // Parse warnings (⚠️)
      else if (line.includes('⚠️')) {
        const issue = this.parseIssueLine(line, 'warning');
        if (issue) {
          issueMap.set(issue.toKey(), issue);
        }
      }
      // Skip code context lines (indented lines after issues)
      // These are the multi-line parts we ignore
    }
    
    return {
      issues: Array.from(issueMap.values())
    };
  }
  
  private parseIssueLine(line: string, type: 'error' | 'warning'): BuildIssue | null {
    // Remove the emoji first
    const withoutEmoji = line
      .replace(/❌\s*/, '')
      .replace(/⚠️\s*/, '')
      .trim();
    
    // Remove ANSI color codes throughout the line
    const cleanLine = withoutEmoji.replace(/\x1b\[[0-9;]*m/g, '');
    
    // Try to extract file:line:column: message format
    const fileMatch = cleanLine.match(/^([^:]+):(\d+):(\d+):\s*(.*)$/);
    
    if (fileMatch) {
      const [, file, lineStr, columnStr, message] = fileMatch;
      
      return type === 'error'
        ? BuildIssue.error(message, file, parseInt(lineStr, 10), parseInt(columnStr, 10))
        : BuildIssue.warning(message, file, parseInt(lineStr, 10), parseInt(columnStr, 10));
    }
    
    // No file information - just the message
    // Handle cases like "error: no such module" or "warning: deprecated"
    const messageMatch = cleanLine.match(/^(?:error|warning):\s*(.*)$/);
    if (messageMatch) {
      return type === 'error'
        ? BuildIssue.error(messageMatch[1])
        : BuildIssue.warning(messageMatch[1]);
    }
    
    // Fallback - use the whole cleaned line as the message
    if (cleanLine) {
      return type === 'error'
        ? BuildIssue.error(cleanLine)
        : BuildIssue.warning(cleanLine);
    }
    
    return null;
  }
}