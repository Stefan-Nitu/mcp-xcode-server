import { ICommandExecutor } from '../../application/ports/CommandPorts.js';

/**
 * Infrastructure adapter for detecting system architecture
 * 
 * This is an infrastructure concern because it queries the operating system
 * for hardware information.
 */
export class SystemArchitectureDetector {
  private detectionResult: boolean | null = null;
  
  constructor(private executor: ICommandExecutor) {}
  
  async isAppleSilicon(): Promise<boolean> {
    if (this.detectionResult !== null) {
      return this.detectionResult;
    }
    
    // Try the most reliable method first
    try {
      const result = await this.executor.execute('sysctl -n hw.optional.arm64');
      this.detectionResult = result.stdout.trim() === '1';
      return this.detectionResult;
    } catch {
      // Sysctl failed, try fallback
    }
    
    // Fallback to uname
    try {
      const result = await this.executor.execute('uname -m');
      this.detectionResult = result.stdout.trim() === 'arm64';
      return this.detectionResult;
    } catch {
      // Both methods failed, default to x86_64
      this.detectionResult = false;
      return this.detectionResult;
    }
  }
  
  async getCurrentArchitecture(): Promise<string> {
    const isArm = await this.isAppleSilicon();
    return isArm ? 'arm64' : 'x86_64';
  }
}