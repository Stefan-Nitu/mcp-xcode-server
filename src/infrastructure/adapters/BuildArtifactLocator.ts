import { existsSync } from 'fs';
import { createModuleLogger } from '../../logger.js';
import { IAppLocator, ICommandExecutor } from '../../application/ports/BuildPorts.js';
import { ShellCommandExecutor } from './ShellCommandExecutor.js';

const logger = createModuleLogger('BuildArtifactLocator');

/**
 * Locates build artifacts (application bundles) in DerivedData
 * Single Responsibility: Find .app bundles in build directories
 */
export class BuildArtifactLocator implements IAppLocator {
  constructor(private executor: ICommandExecutor = new ShellCommandExecutor()) {}

  /**
   * Find the built app in DerivedData
   * @param derivedDataPath Path to DerivedData directory
   * @returns Path to the .app bundle, or undefined if not found
   */
  async findApp(derivedDataPath: string): Promise<string | undefined> {
    try {
      const result = await this.executor.execute(
        `find "${derivedDataPath}" -name "*.app" -type d | head -1`,
        { timeout: 5000 } // 5 second timeout for find
      );
      
      const appPath = result.stdout.trim();
      
      if (!appPath) {
        logger.warn({ derivedDataPath }, 'No app found in DerivedData');
        return undefined;
      }
      
      logger.info({ appPath }, 'Found app at path');
      
      // Verify the app actually exists
      if (!existsSync(appPath)) {
        logger.error({ appPath }, 'App path does not exist!');
        return undefined;
      }
      
      return appPath;
    } catch (error: any) {
      logger.error({ error: error.message, derivedDataPath }, 'Error finding app path');
      return undefined;
    }
  }
}