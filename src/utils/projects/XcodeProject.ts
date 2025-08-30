import { XcodeBuild, BuildOptions, TestOptions } from './XcodeBuild.js';
import { XcodeArchive, ArchiveOptions, ExportOptions } from './XcodeArchive.js';
import { XcodeInfo } from './XcodeInfo.js';
import { BuildError, CompileError } from '../errors/index.js';
import { createModuleLogger } from '../../logger.js';
import * as pathModule from 'path';
import { Platform } from '../../types.js';

const logger = createModuleLogger('XcodeProject');

/**
 * Represents an Xcode project (.xcodeproj) or workspace (.xcworkspace)
 */
export class XcodeProject {
  public readonly name: string;
  private build: XcodeBuild;
  private archive: XcodeArchive;
  private info: XcodeInfo;
  
  constructor(
    public readonly path: string,
    public readonly type: 'project' | 'workspace',
    components?: {
      build?: XcodeBuild;
      archive?: XcodeArchive;
      info?: XcodeInfo;
    }
  ) {
    // Extract name from path
    const ext = type === 'workspace' ? '.xcworkspace' : '.xcodeproj';
    this.name = pathModule.basename(this.path, ext);
    
    // Initialize components
    this.build = components?.build || new XcodeBuild();
    this.archive = components?.archive || new XcodeArchive();
    this.info = components?.info || new XcodeInfo();
    
    logger.debug({ path: this.path, type, name: this.name }, 'XcodeProject created');
  }
  
  /**
   * Build the project
   */
  async buildProject(options: BuildOptions = {}): Promise<{
    success: boolean;
    output: string;
    appPath?: string;
    logPath?: string;
    errors?: CompileError[];
  }> {
    logger.info({ path: this.path, options }, 'Building Xcode project');
    
    const isWorkspace = this.type === 'workspace';
    return await this.build.build(this.path, isWorkspace, options);
  }
  
  /**
   * Run tests for the project
   */
  async test(options: TestOptions = {}): Promise<{
    success: boolean;
    output: string;
    passed: number;
    failed: number;
    failingTests?: Array<{ identifier: string; reason: string }>;
    compileErrors?: CompileError[];
    buildErrors?: BuildError[];
    logPath: string;
  }> {
    logger.info({ path: this.path, options }, 'Testing Xcode project');
    
    const isWorkspace = this.type === 'workspace';
    return await this.build.test(this.path, isWorkspace, options);
  }
  
  /**
   * Archive the project for distribution
   */
  async archiveProject(options: ArchiveOptions): Promise<{
    success: boolean;
    archivePath: string;
  }> {
    logger.info({ path: this.path, options }, 'Archiving Xcode project');
    
    const isWorkspace = this.type === 'workspace';
    return await this.archive.archive(this.path, isWorkspace, options);
  }
  
  /**
   * Export an IPA from an archive
   */
  async exportIPA(
    archivePath: string,
    options: ExportOptions = {}
  ): Promise<{
    success: boolean;
    ipaPath: string;
  }> {
    logger.info({ archivePath, options }, 'Exporting IPA');
    
    return await this.archive.exportIPA(archivePath, options);
  }
  
  /**
   * Clean build artifacts
   */
  async clean(options: {
    scheme?: string;
    configuration?: string;
  } = {}): Promise<void> {
    logger.info({ path: this.path, options }, 'Cleaning Xcode project');
    
    const isWorkspace = this.type === 'workspace';
    await this.build.clean(this.path, isWorkspace, options);
  }
  
  /**
   * Get list of schemes
   */
  async getSchemes(): Promise<string[]> {
    const isWorkspace = this.type === 'workspace';
    return await this.info.getSchemes(this.path, isWorkspace);
  }
  
  /**
   * Get list of targets
   */
  async getTargets(): Promise<string[]> {
    const isWorkspace = this.type === 'workspace';
    return await this.info.getTargets(this.path, isWorkspace);
  }
  
  /**
   * Get build settings for a scheme
   */
  async getBuildSettings(
    scheme: string,
    configuration?: string,
    platform?: Platform
  ): Promise<any> {
    const isWorkspace = this.type === 'workspace';
    return await this.info.getBuildSettings(
      this.path,
      isWorkspace,
      scheme,
      configuration,
      platform
    );
  }
  
  /**
   * Get comprehensive project information
   */
  async getProjectInfo(): Promise<{
    name: string;
    schemes: string[];
    targets: string[];
    configurations: string[];
  }> {
    const isWorkspace = this.type === 'workspace';
    return await this.info.getProjectInfo(this.path, isWorkspace);
  }
  
  /**
   * Check if this is a workspace
   */
  isWorkspace(): boolean {
    return this.type === 'workspace';
  }
  
  /**
   * Get the project directory
   */
  getDirectory(): string {
    return pathModule.dirname(this.path);
  }
}