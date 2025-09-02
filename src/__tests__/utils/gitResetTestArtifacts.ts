/**
 * Utility to reset test artifacts using git
 * This ensures consistent cleanup across all test utilities
 */

import { execSync } from 'child_process';
import { resolve } from 'path';
import { createModuleLogger } from '../../logger.js';

const logger = createModuleLogger('GitResetTestArtifacts');

/**
 * Reset test_artifacts directory to pristine git state
 * @param path - Optional specific path within test_artifacts to reset
 */
export function gitResetTestArtifacts(path?: string): void {
  const targetPath = path || 'test_artifacts/';
  
  try {
    // Remove untracked files and directories (build artifacts)
    execSync(`git clean -fdx ${targetPath}`, { 
      cwd: resolve(process.cwd()),
      stdio: 'pipe'
    });
    
    // First unstage any staged changes
    execSync(`git reset HEAD ${targetPath}`, { 
      cwd: resolve(process.cwd()),
      stdio: 'pipe'
    });
    
    // Then reset any modified tracked files
    execSync(`git checkout -- ${targetPath}`, { 
      cwd: resolve(process.cwd()),
      stdio: 'pipe'
    });
    
    logger.debug({ path: targetPath }, 'Reset test artifacts using git');
  } catch (error) {
    logger.error({ error, path: targetPath }, 'Failed to reset test artifacts');
    // Don't throw - cleanup should be best effort
  }
}

/**
 * Reset a specific file within test_artifacts
 * @param filePath - Path to the file relative to project root
 */
export function gitResetFile(filePath: string): void {
  try {
    // Only reset if the file is within test_artifacts
    if (!filePath.includes('test_artifacts')) {
      logger.warn({ filePath }, 'Attempting to reset file outside test_artifacts - skipping');
      return;
    }
    
    execSync(`git checkout -- ${filePath}`, { 
      cwd: resolve(process.cwd()),
      stdio: 'pipe'
    });
    
    logger.debug({ filePath }, 'Reset file using git');
  } catch (error) {
    logger.warn({ error, filePath }, 'Failed to reset file - may be untracked');
  }
}