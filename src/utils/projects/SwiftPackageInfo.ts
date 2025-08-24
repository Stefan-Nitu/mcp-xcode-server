import { execAsync } from '../../utils.js';
import { createModuleLogger } from '../../logger.js';

const logger = createModuleLogger('SwiftPackageInfo');

export interface Dependency {
  name: string;
  url: string;
  version?: string;
  branch?: string;
  revision?: string;
}

export interface Product {
  name: string;
  type: 'executable' | 'library';
  targets: string[];
}

/**
 * Queries information about Swift packages
 */
export class SwiftPackageInfo {
  /**
   * Get list of products in a package
   */
  async getProducts(packagePath: string): Promise<Product[]> {
    const command = `swift package --package-path "${packagePath}" describe --type json`;
    
    logger.debug({ command }, 'Describe package command');
    
    try {
      const { stdout } = await execAsync(command);
      const packageInfo = JSON.parse(stdout);
      
      const products: Product[] = packageInfo.products?.map((p: any) => ({
        name: p.name,
        type: p.type?.executable ? 'executable' : 'library',
        targets: p.targets || []
      })) || [];
      
      logger.debug({ packagePath, products }, 'Found products');
      return products;
    } catch (error: any) {
      logger.error({ error: error.message, packagePath }, 'Failed to get products');
      throw new Error(`Failed to get products: ${error.message}`);
    }
  }
  
  /**
   * Get list of targets in a package
   */
  async getTargets(packagePath: string): Promise<string[]> {
    const command = `swift package --package-path "${packagePath}" describe --type json`;
    
    logger.debug({ command }, 'Describe package command');
    
    try {
      const { stdout } = await execAsync(command);
      const packageInfo = JSON.parse(stdout);
      
      const targets = packageInfo.targets?.map((t: any) => t.name) || [];
      
      logger.debug({ packagePath, targets }, 'Found targets');
      return targets;
    } catch (error: any) {
      logger.error({ error: error.message, packagePath }, 'Failed to get targets');
      throw new Error(`Failed to get targets: ${error.message}`);
    }
  }
  
  /**
   * Get list of dependencies
   */
  async getDependencies(packagePath: string): Promise<Dependency[]> {
    const command = `swift package --package-path "${packagePath}" show-dependencies --format json`;
    
    logger.debug({ command }, 'Show dependencies command');
    
    try {
      const { stdout } = await execAsync(command);
      const depTree = JSON.parse(stdout);
      
      // Extract direct dependencies from the tree
      const dependencies: Dependency[] = depTree.dependencies?.map((d: any) => ({
        name: d.name,
        url: d.url,
        version: d.version,
        branch: d.branch,
        revision: d.revision
      })) || [];
      
      logger.debug({ packagePath, dependencies }, 'Found dependencies');
      return dependencies;
    } catch (error: any) {
      logger.error({ error: error.message, packagePath }, 'Failed to get dependencies');
      throw new Error(`Failed to get dependencies: ${error.message}`);
    }
  }
  
  /**
   * Add a dependency to the package
   */
  async addDependency(
    packagePath: string,
    url: string,
    options: {
      version?: string;
      branch?: string;
      exact?: boolean;
      from?: string;
      upToNextMajor?: string;
    } = {}
  ): Promise<void> {
    let command = `swift package --package-path "${packagePath}" add-dependency "${url}"`;
    
    if (options.branch) {
      command += ` --branch "${options.branch}"`;
    } else if (options.exact) {
      command += ` --exact "${options.version}"`;
    } else if (options.from) {
      command += ` --from "${options.from}"`;
    } else if (options.upToNextMajor) {
      command += ` --up-to-next-major-from "${options.upToNextMajor}"`;
    }
    
    logger.debug({ command }, 'Add dependency command');
    
    try {
      await execAsync(command);
      logger.info({ packagePath, url }, 'Dependency added');
    } catch (error: any) {
      logger.error({ error: error.message, packagePath, url }, 'Failed to add dependency');
      throw new Error(`Failed to add dependency: ${error.message}`);
    }
  }
  
  /**
   * Remove a dependency from the package
   */
  async removeDependency(packagePath: string, name: string): Promise<void> {
    const command = `swift package --package-path "${packagePath}" remove-dependency "${name}"`;
    
    logger.debug({ command }, 'Remove dependency command');
    
    try {
      await execAsync(command);
      logger.info({ packagePath, name }, 'Dependency removed');
    } catch (error: any) {
      logger.error({ error: error.message, packagePath, name }, 'Failed to remove dependency');
      throw new Error(`Failed to remove dependency: ${error.message}`);
    }
  }
  
  /**
   * Update package dependencies
   */
  async updateDependencies(packagePath: string): Promise<void> {
    const command = `swift package --package-path "${packagePath}" update`;
    
    logger.debug({ command }, 'Update dependencies command');
    
    try {
      await execAsync(command);
      logger.info({ packagePath }, 'Dependencies updated');
    } catch (error: any) {
      logger.error({ error: error.message, packagePath }, 'Failed to update dependencies');
      throw new Error(`Failed to update dependencies: ${error.message}`);
    }
  }
  
  /**
   * Resolve package dependencies
   */
  async resolveDependencies(packagePath: string): Promise<void> {
    const command = `swift package --package-path "${packagePath}" resolve`;
    
    logger.debug({ command }, 'Resolve dependencies command');
    
    try {
      await execAsync(command);
      logger.info({ packagePath }, 'Dependencies resolved');
    } catch (error: any) {
      logger.error({ error: error.message, packagePath }, 'Failed to resolve dependencies');
      throw new Error(`Failed to resolve dependencies: ${error.message}`);
    }
  }
}