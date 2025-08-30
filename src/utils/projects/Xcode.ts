import { XcodeProject } from './XcodeProject.js';
import { SwiftPackage } from './SwiftPackage.js';
import { XcodeError, XcodeErrorType } from './XcodeErrors.js';
import { createModuleLogger } from '../../logger.js';
import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import path from 'path';

const logger = createModuleLogger('Xcode');

/**
 * Xcode project discovery and management.
 * Provides methods to find and open Xcode projects and Swift packages.
 */
export class Xcode {
  /**
   * Open a project at the specified path.
   * Automatically detects whether it's an Xcode project or Swift package.
   * @param projectPath Path to the project
   * @param expectedType Optional type to expect ('xcode' | 'swift-package' | 'auto')
   */
  async open(projectPath: string, expectedType: 'xcode' | 'swift-package' | 'auto' = 'auto'): Promise<XcodeProject | SwiftPackage> {
    // If expecting Swift package specifically, only look for Package.swift
    if (expectedType === 'swift-package') {
      // Check if it's a Package.swift file directly
      if (projectPath.endsWith('Package.swift')) {
        if (!existsSync(projectPath)) {
          throw new Error(`No Package.swift found at: ${projectPath}`);
        }
        const packageDir = path.dirname(projectPath);
        logger.debug({ packageDir }, 'Opening Swift package from Package.swift');
        return new SwiftPackage(packageDir);
      }
      
      // Check if directory contains Package.swift
      if (existsSync(projectPath)) {
        const packageSwiftPath = path.join(projectPath, 'Package.swift');
        if (existsSync(packageSwiftPath)) {
          logger.debug({ projectPath }, 'Found Package.swift in directory');
          return new SwiftPackage(projectPath);
        }
      }
      
      throw new Error(`No Package.swift found at: ${projectPath}`);
    }
    
    // If expecting Xcode project specifically, only look for .xcodeproj/.xcworkspace
    if (expectedType === 'xcode') {
      // Check if it's an Xcode project or workspace
      if (projectPath.endsWith('.xcodeproj') || projectPath.endsWith('.xcworkspace')) {
        if (!existsSync(projectPath)) {
          throw new Error(`No Xcode project found at: ${projectPath}`);
        }
        const type = projectPath.endsWith('.xcworkspace') ? 'workspace' : 'project';
        logger.debug({ projectPath, type }, 'Opening Xcode project');
        return new XcodeProject(projectPath, type);
      }
      
      // Check directory for Xcode projects
      if (existsSync(projectPath)) {
        const files = await readdir(projectPath);
        
        const workspace = files.find(f => f.endsWith('.xcworkspace'));
        if (workspace) {
          const workspacePath = path.join(projectPath, workspace);
          logger.debug({ workspacePath }, 'Found workspace in directory');
          return new XcodeProject(workspacePath, 'workspace');
        }
        
        const xcodeproj = files.find(f => f.endsWith('.xcodeproj'));
        if (xcodeproj) {
          const xcodeprojPath = path.join(projectPath, xcodeproj);
          logger.debug({ xcodeprojPath }, 'Found Xcode project in directory');
          return new XcodeProject(xcodeprojPath, 'project');
        }
      }
      
      throw new Error(`No Xcode project found at: ${projectPath}`);
    }
    
    // Auto mode - original behavior
    // Check if it's an Xcode project or workspace
    if (projectPath.endsWith('.xcodeproj') || projectPath.endsWith('.xcworkspace')) {
      if (!existsSync(projectPath)) {
        throw new Error(`Xcode project not found at: ${projectPath}`);
      }
      const type = projectPath.endsWith('.xcworkspace') ? 'workspace' : 'project';
      logger.debug({ projectPath, type }, 'Opening Xcode project');
      return new XcodeProject(projectPath, type);
    }
    
    // Check if it's a Swift package (directory containing Package.swift)
    const packagePath = path.join(projectPath, 'Package.swift');
    if (existsSync(packagePath)) {
      logger.debug({ projectPath }, 'Opening Swift package');
      return new SwiftPackage(projectPath);
    }
    
    // If it's a Package.swift file directly
    if (projectPath.endsWith('Package.swift') && existsSync(projectPath)) {
      const packageDir = path.dirname(projectPath);
      logger.debug({ packageDir }, 'Opening Swift package from Package.swift');
      return new SwiftPackage(packageDir);
    }
    
    // Try to auto-detect in the directory
    if (existsSync(projectPath)) {
      // Look for .xcworkspace first (higher priority)
      const files = await readdir(projectPath);
      
      const workspace = files.find(f => f.endsWith('.xcworkspace'));
      if (workspace) {
        const workspacePath = path.join(projectPath, workspace);
        logger.debug({ workspacePath }, 'Found workspace in directory');
        return new XcodeProject(workspacePath, 'workspace');
      }
      
      const xcodeproj = files.find(f => f.endsWith('.xcodeproj'));
      if (xcodeproj) {
        const xcodeprojPath = path.join(projectPath, xcodeproj);
        logger.debug({ xcodeprojPath }, 'Found Xcode project in directory');
        return new XcodeProject(xcodeprojPath, 'project');
      }
      
      // Check for Package.swift
      if (files.includes('Package.swift')) {
        logger.debug({ projectPath }, 'Found Package.swift in directory');
        return new SwiftPackage(projectPath);
      }
    }
    
    throw new XcodeError(XcodeErrorType.ProjectNotFound, projectPath);
  }
  
  /**
   * Find all Xcode projects in a directory
   */
  async findProjects(directory: string): Promise<XcodeProject[]> {
    const projects: XcodeProject[] = [];
    
    try {
      const files = await readdir(directory, { withFileTypes: true });
      
      for (const file of files) {
        const fullPath = path.join(directory, file.name);
        
        if (file.name.endsWith('.xcworkspace')) {
          projects.push(new XcodeProject(fullPath, 'workspace'));
        } else if (file.name.endsWith('.xcodeproj')) {
          // Only add if there's no workspace (workspace takes precedence)
          const workspaceName = file.name.replace('.xcodeproj', '.xcworkspace');
          const hasWorkspace = files.some(f => f.name === workspaceName);
          if (!hasWorkspace) {
            projects.push(new XcodeProject(fullPath, 'project'));
          }
        } else if (file.isDirectory() && !file.name.startsWith('.')) {
          // Recursively search subdirectories
          const subProjects = await this.findProjects(fullPath);
          projects.push(...subProjects);
        }
      }
    } catch (error: any) {
      logger.error({ error: error.message, directory }, 'Failed to find projects');
      throw new Error(`Failed to find projects in ${directory}: ${error.message}`);
    }
    
    logger.debug({ count: projects.length, directory }, 'Found Xcode projects');
    return projects;
  }
  
  /**
   * Find all Swift packages in a directory
   */
  async findPackages(directory: string): Promise<SwiftPackage[]> {
    const packages: SwiftPackage[] = [];
    
    try {
      const files = await readdir(directory, { withFileTypes: true });
      
      // Check if this directory itself is a package
      if (files.some(f => f.name === 'Package.swift')) {
        packages.push(new SwiftPackage(directory));
      }
      
      // Search subdirectories
      for (const file of files) {
        if (file.isDirectory() && !file.name.startsWith('.')) {
          const fullPath = path.join(directory, file.name);
          const subPackages = await this.findPackages(fullPath);
          packages.push(...subPackages);
        }
      }
    } catch (error: any) {
      logger.error({ error: error.message, directory }, 'Failed to find packages');
      throw new Error(`Failed to find packages in ${directory}: ${error.message}`);
    }
    
    logger.debug({ count: packages.length, directory }, 'Found Swift packages');
    return packages;
  }
  
  /**
   * Find all projects and packages in a directory
   */
  async findAll(directory: string): Promise<(XcodeProject | SwiftPackage)[]> {
    const [projects, packages] = await Promise.all([
      this.findProjects(directory),
      this.findPackages(directory)
    ]);
    
    const all = [...projects, ...packages];
    logger.debug({ 
      totalCount: all.length, 
      projectCount: projects.length, 
      packageCount: packages.length,
      directory 
    }, 'Found all projects and packages');
    
    return all;
  }
}

// Export a default instance for convenience
export const xcode = new Xcode();