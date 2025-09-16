import { OutputFormatterError } from '../../../features/build/domain/BuildResult.js';
import { ErrorFormattingStrategy } from './ErrorFormattingStrategy.js';

/**
 * Formats output formatter errors (e.g., xcbeautify not installed)
 */
export class OutputFormatterErrorStrategy implements ErrorFormattingStrategy {
  canFormat(error: any): boolean {
    return error instanceof OutputFormatterError;
  }
  
  format(error: OutputFormatterError): string {
    return `xcbeautify failed: ${error.stderr}`;
  }
}