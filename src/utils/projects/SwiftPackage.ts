import { SwiftBuild, SwiftBuildOptions, SwiftRunOptions, SwiftTestOptions } from './SwiftBuild.js';
import { SwiftPackageInfo, Dependency, Product } from './SwiftPackageInfo.js';
import { Issue } from '../errors/index.js';
import { createModuleLogger } from '../../logger.js';
import * as pathModule from 'path';
import { existsSync } from 'fs';

const logger = createModuleLogger('SwiftPackage');

/**
 * Represents a Swift package (Package.swift)
 */
export class SwiftPackage {
  public readonly name: string;
  private build: SwiftBuild;
  private info: SwiftPackageInfo;
  
  constructor(
    public readonly path: string,
    components?: {
      build?: SwiftBuild;
      info?: SwiftPackageInfo;
    }
  ) {
    // Validate that Package.swift exists
    const packageSwiftPath = pathModule.join(this.path, 'Package.swift');
    if (!existsSync(packageSwiftPath)) {
      throw new Error(`No Package.swift found at: ${this.path}`);
    }
    
    // Extract name from directory
    this.name = pathModule.basename(this.path);
    
    // Initialize components
    this.build = components?.build || new SwiftBuild();
    this.info = components?.info || new SwiftPackageInfo();
    
    logger.debug({ path: this.path, name: this.name }, 'SwiftPackage created');
  }
  
  /**
   * Build the package
   */
  async buildPackage(options: SwiftBuildOptions = {}): Promise<{
    success: boolean;
    output: string;
    logPath?: string;
    compileErrors?: Issue[];
    buildErrors?: Issue[];
  }> {
    logger.info({ path: this.path, options }, 'Building Swift package');
    
    return await this.build.build(this.path, options);
  }
  
  /**
   * Run an executable from the package
   */
  async run(options: SwiftRunOptions = {}): Promise<{
    success: boolean;
    output: string;
    logPath?: string;
    compileErrors?: Issue[];
    buildErrors?: Issue[];
  }> {
    logger.info({ path: this.path, options }, 'Running Swift package');
    
    return await this.build.run(this.path, options);
  }
  
  /**
   * Test the package
   */
  async test(options: SwiftTestOptions = {}): Promise<{
    success: boolean;
    output: string;
    passed: number;
    failed: number;
    failingTests?: Array<{ identifier: string; reason: string }>;
    compileErrors?: Issue[];
    buildErrors?: Issue[];
    logPath: string;
  }> {
    logger.info({ path: this.path, options }, 'Testing Swift package');
    
    return await this.build.test(this.path, options);
  }
  
  /**
   * Clean build artifacts
   */
  async clean(): Promise<void> {
    logger.info({ path: this.path }, 'Cleaning Swift package');
    
    await this.build.clean(this.path);
  }
  
  /**
   * Get list of products (executables and libraries)
   */
  async getProducts(): Promise<Product[]> {
    return await this.info.getProducts(this.path);
  }
  
  /**
   * Get list of targets
   */
  async getTargets(): Promise<string[]> {
    return await this.info.getTargets(this.path);
  }
  
  /**
   * Get list of dependencies
   */
  async getDependencies(): Promise<Dependency[]> {
    return await this.info.getDependencies(this.path);
  }
  
  /**
   * Add a dependency
   */
  async addDependency(
    url: string,
    options: {
      version?: string;
      branch?: string;
      exact?: boolean;
      from?: string;
      upToNextMajor?: string;
    } = {}
  ): Promise<void> {
    logger.info({ path: this.path, url, options }, 'Adding dependency');
    
    await this.info.addDependency(this.path, url, options);
  }
  
  /**
   * Remove a dependency
   */
  async removeDependency(name: string): Promise<void> {
    logger.info({ path: this.path, name }, 'Removing dependency');
    
    await this.info.removeDependency(this.path, name);
  }
  
  /**
   * Update all dependencies
   */
  async updateDependencies(): Promise<void> {
    logger.info({ path: this.path }, 'Updating dependencies');
    
    await this.info.updateDependencies(this.path);
  }
  
  /**
   * Resolve dependencies
   */
  async resolveDependencies(): Promise<void> {
    logger.info({ path: this.path }, 'Resolving dependencies');
    
    await this.info.resolveDependencies(this.path);
  }
  
  /**
   * Get the package directory
   */
  getDirectory(): string {
    return this.path;
  }
  
  /**
   * Check if this is an executable package
   */
  async isExecutable(): Promise<boolean> {
    const products = await this.getProducts();
    return products.some(p => p.type === 'executable');
  }
  
  /**
   * Get executable products
   */
  async getExecutables(): Promise<string[]> {
    const products = await this.getProducts();
    return products
      .filter(p => p.type === 'executable')
      .map(p => p.name);
  }
}