/**
 * Strategy interface for formatting different types of errors
 */
export interface ErrorFormattingStrategy {
  canFormat(error: any): boolean;
  format(error: any): string;
}