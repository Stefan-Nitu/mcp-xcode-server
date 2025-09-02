/**
 * Interface for log management operations
 * Cross-cutting concern used by multiple use cases
 */
export interface ILogManager {
  saveLog(
    operation: 'build' | 'test' | 'run' | 'archive' | 'clean',
    content: string,
    projectName?: string,
    metadata?: Record<string, any>
  ): string;
  
  saveDebugData(
    operation: string,
    data: any,
    projectName?: string
  ): string;
}