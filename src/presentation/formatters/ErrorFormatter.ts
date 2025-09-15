import { ErrorFormattingStrategy } from './strategies/ErrorFormattingStrategy.js';
import { BuildIssuesStrategy } from './strategies/BuildIssuesStrategy.js';
import { OutputFormatterErrorStrategy } from './strategies/OutputFormatterErrorStrategy.js';
import { DefaultErrorStrategy } from './strategies/DefaultErrorStrategy.js';

/**
 * Main error formatter that uses strategies
 */
export class ErrorFormatter {
  private static strategies: ErrorFormattingStrategy[] = [
    new BuildIssuesStrategy(),
    new OutputFormatterErrorStrategy(),
    new DefaultErrorStrategy() // Must be last - catches all other errors
  ];
  
  /**
   * Format any error into a user-friendly message
   */
  static format(error: Error | any): string {
    for (const strategy of this.strategies) {
      if (strategy.canFormat(error)) {
        return strategy.format(error);
      }
    }
    
    // Shouldn't reach here due to DefaultErrorStrategy
    return 'Unknown error';
  }
}