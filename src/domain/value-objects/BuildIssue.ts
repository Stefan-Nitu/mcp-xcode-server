/**
 * Domain Value Object: Represents a build issue (error or warning)
 * 
 * This is a value object because:
 * - No identity (two identical errors are the same error)
 * - Immutable (issues don't change)
 * - Equality by value (same file/line/message = same issue)
 */
export class BuildIssue {
  constructor(
    public readonly type: 'error' | 'warning',
    public readonly message: string,
    public readonly file?: string,
    public readonly line?: number,
    public readonly column?: number
  ) {
    // Validate required fields
    if (!message || message.trim().length === 0) {
      throw new Error('Build issue message cannot be empty');
    }
    
    // Validate line/column make sense
    if (line !== undefined && line < 1) {
      throw new Error('Line number must be positive');
    }
    if (column !== undefined && column < 1) {
      throw new Error('Column number must be positive');
    }
  }
  
  /**
   * Create an error issue
   */
  static error(
    message: string,
    file?: string,
    line?: number,
    column?: number
  ): BuildIssue {
    return new BuildIssue('error', message, file, line, column);
  }
  
  /**
   * Create a warning issue
   */
  static warning(
    message: string,
    file?: string,
    line?: number,
    column?: number
  ): BuildIssue {
    return new BuildIssue('warning', message, file, line, column);
  }
  
  /**
   * Check if this is an error
   */
  isError(): boolean {
    return this.type === 'error';
  }
  
  /**
   * Check if this is a warning
   */
  isWarning(): boolean {
    return this.type === 'warning';
  }
  
  /**
   * Check if this issue has file location information
   */
  hasLocation(): boolean {
    return this.file !== undefined;
  }
  
  /**
   * Format as string with location if available
   */
  toString(): string {
    if (this.hasLocation()) {
      return `${this.file}:${this.line}:${this.column}: ${this.message}`;
    }
    return this.message;
  }
  
  /**
   * Create a unique key for deduplication
   * Two issues with the same key are considered the same issue
   */
  toKey(): string {
    return `${this.type}:${this.file || ''}:${this.line || 0}:${this.column || 0}:${this.message}`;
  }
  
  /**
   * Check equality with another issue
   */
  equals(other: BuildIssue): boolean {
    return this.toKey() === other.toKey();
  }
}