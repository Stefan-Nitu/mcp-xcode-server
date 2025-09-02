/**
 * Interface for log management operations
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