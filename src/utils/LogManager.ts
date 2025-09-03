import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Manages persistent logs for MCP server debugging
 * Stores logs in ~/.mcp-xcode-server/logs/ with daily rotation
 */
export class LogManager {
  private static readonly LOG_DIR = path.join(os.homedir(), '.mcp-xcode-server', 'logs');
  private static readonly MAX_AGE_DAYS = 7;
  
  /**
   * Initialize log directory structure
   */
  private init(): void {
    if (!fs.existsSync(LogManager.LOG_DIR)) {
      fs.mkdirSync(LogManager.LOG_DIR, { recursive: true });
    }
    
    // Clean up old logs on startup
    this.cleanupOldLogs();
  }
  
  /**
   * Get the log directory for today
   */
  private getTodayLogDir(): string {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dir = path.join(LogManager.LOG_DIR, today);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    return dir;
  }
  
  /**
   * Generate a log filename with timestamp
   */
  private getLogFilename(operation: string, projectName?: string): string {
    const timestamp = new Date().toISOString()
      .replace(/:/g, '-')
      .replace(/\./g, '-')
      .split('T')[1]
      .slice(0, 8); // HH-MM-SS
    
    const name = projectName ? `${operation}-${projectName}` : operation;
    return `${timestamp}-${name}.log`;
  }
  
  /**
   * Save log content to a file
   * Returns the full path to the log file
   */
  saveLog(
    operation: 'build' | 'test' | 'run' | 'archive' | 'clean',
    content: string,
    projectName?: string,
    metadata?: Record<string, any>
  ): string {
    const dir = this.getTodayLogDir();
    const filename = this.getLogFilename(operation, projectName);
    const filepath = path.join(dir, filename);
    
    // Add metadata header if provided
    let fullContent = '';
    if (metadata) {
      fullContent += '=== Log Metadata ===\n';
      fullContent += JSON.stringify(metadata, null, 2) + '\n';
      fullContent += '=== End Metadata ===\n\n';
    }
    fullContent += content;
    
    fs.writeFileSync(filepath, fullContent, 'utf8');
    
    // Also create/update a symlink to latest log
    const latestLink = path.join(LogManager.LOG_DIR, `latest-${operation}.log`);
    if (fs.existsSync(latestLink)) {
      fs.unlinkSync(latestLink);
    }
    
    // Create relative symlink for portability
    const relativePath = `./${new Date().toISOString().split('T')[0]}/${filename}`;
    try {
      // Use execSync to create symlink as fs.symlinkSync has issues on some systems
      const { execSync } = require('child_process');
      execSync(`ln -s "${relativePath}" "${latestLink}"`, { cwd: LogManager.LOG_DIR });
    } catch {
      // Symlink creation failed, not critical
    }
    
    return filepath;
  }
  
  /**
   * Save debug data (like parsed xcresult) for analysis
   */
  saveDebugData(
    operation: string,
    data: any,
    projectName?: string
  ): string {
    const dir = this.getTodayLogDir();
    const timestamp = new Date().toISOString()
      .replace(/:/g, '-')
      .replace(/\./g, '-')
      .split('T')[1]
      .slice(0, 8);
    
    const name = projectName ? `${operation}-${projectName}` : operation;
    const filename = `${timestamp}-${name}-debug.json`;
    const filepath = path.join(dir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
    
    return filepath;
  }
  
  /**
   * Clean up logs older than MAX_AGE_DAYS
   */
  cleanupOldLogs(): void {
    if (!fs.existsSync(LogManager.LOG_DIR)) {
      return;
    }
    
    const now = Date.now();
    const maxAge = LogManager.MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    
    try {
      const entries = fs.readdirSync(LogManager.LOG_DIR);
      
      for (const entry of entries) {
        const fullPath = path.join(LogManager.LOG_DIR, entry);
        
        // Skip symlinks
        const stat = fs.statSync(fullPath);
        if (stat.isSymbolicLink()) {
          continue;
        }
        
        // Check if it's a date directory (YYYY-MM-DD format)
        if (stat.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry)) {
          const dirDate = new Date(entry).getTime();
          
          if (now - dirDate > maxAge) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          }
        }
      }
    } catch (error) {
      // Cleanup failed, not critical
    }
  }
  
  /**
   * Get the user-friendly log path for display
   */
  getDisplayPath(fullPath: string): string {
    // Replace home directory with ~
    const home = os.homedir();
    return fullPath.replace(home, '~');
  }
  
  /**
   * Get the log directory path
   */
  getLogDirectory(): string {
    return LogManager.LOG_DIR;
  }
}