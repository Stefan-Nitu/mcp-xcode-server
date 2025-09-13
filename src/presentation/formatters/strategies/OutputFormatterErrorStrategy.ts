import { OutputFormatterError } from '../../../domain/entities/BuildResult.js';
import { ErrorFormattingStrategy } from './ErrorFormattingStrategy.js';

/**
 * Formats output formatter errors (e.g., xcbeautify not installed)
 */
export class OutputFormatterErrorStrategy implements ErrorFormattingStrategy {
  canFormat(error: any): boolean {
    return error instanceof OutputFormatterError;
  }
  
  format(error: OutputFormatterError): string {
    if (error.installCommand) {
      return `${error.tool} is not installed. Please install it with: ${error.installCommand}`;
    }
    return `Output formatter '${error.tool}' is not available`;
  }
}