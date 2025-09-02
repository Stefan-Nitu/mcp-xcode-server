import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createModuleLogger } from '../../logger';
import { gitResetTestArtifacts, gitResetFile } from './gitResetTestArtifacts';

const logger = createModuleLogger('TestErrorInjector');

/**
 * Helper class to inject specific error conditions into test projects
 * for testing error handling and display
 */
export class TestErrorInjector {
  private originalFiles: Map<string, string> = new Map();

  /**
   * Inject a compile error into a Swift file
   */
  injectCompileError(filePath: string, errorType: 'type-mismatch' | 'syntax' | 'missing-member' = 'type-mismatch') {
    this.backupFile(filePath);
    
    let content = readFileSync(filePath, 'utf8');
    
    switch (errorType) {
      case 'type-mismatch':
        // Add a type mismatch error
        content = content.replace(
          'let newItem = Item(timestamp: Date())',
          'let x: String = 123  // Type mismatch error\n        let newItem = Item(timestamp: Date())'
        );
        break;
      
      case 'syntax':
        // Add a syntax error
        content = content.replace(
          'import SwiftUI',
          'import SwiftUI\nlet incomplete = // Syntax error'
        );
        break;
      
      case 'missing-member':
        // Reference a non-existent property
        content = content.replace(
          'modelContext.insert(newItem)',
          'modelContext.insert(newItem)\n        let _ = newItem.nonExistentProperty // Missing member error'
        );
        break;
    }
    
    writeFileSync(filePath, content);
    logger.debug({ filePath, errorType }, 'Injected compile error');
  }

  /**
   * Inject multiple compile errors into a file
   */
  injectMultipleCompileErrors(filePath: string) {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    this.backupFile(filePath);
    
    let content = readFileSync(filePath, 'utf8');
    
    // Add multiple different types of errors
    content = content.replace(
      'let newItem = Item(timestamp: Date())',
      `let x: String = 123  // Type mismatch error 1
        let y: Int = "hello"  // Type mismatch error 2
        let z = nonExistentFunction()  // Undefined function error
        let newItem = Item(timestamp: Date())`
    );
    
    writeFileSync(filePath, content);
    logger.debug({ filePath }, 'Injected multiple compile errors');
  }

  /**
   * Remove code signing from a project to trigger signing errors
   */
  injectCodeSigningError(projectPath: string) {
    const pbxprojPath = join(projectPath, 'project.pbxproj');
    if (!existsSync(pbxprojPath)) {
      throw new Error(`Project file not found: ${pbxprojPath}`);
    }
    
    this.backupFile(pbxprojPath);
    
    let content = readFileSync(pbxprojPath, 'utf8');
    
    // Change code signing settings to trigger errors
    content = content.replace(
      /CODE_SIGN_STYLE = Automatic;/g,
      'CODE_SIGN_STYLE = Manual;'
    );
    content = content.replace(
      /DEVELOPMENT_TEAM = [A-Z0-9]+;/g,
      'DEVELOPMENT_TEAM = "";'
    );
    
    writeFileSync(pbxprojPath, content);
    logger.debug({ projectPath }, 'Injected code signing error');
  }

  /**
   * Inject a provisioning profile error by requiring a non-existent profile
   */
  injectProvisioningError(projectPath: string) {
    const pbxprojPath = join(projectPath, 'project.pbxproj');
    if (!existsSync(pbxprojPath)) {
      throw new Error(`Project file not found: ${pbxprojPath}`);
    }
    
    this.backupFile(pbxprojPath);
    
    let content = readFileSync(pbxprojPath, 'utf8');
    
    // Add a non-existent provisioning profile requirement
    content = content.replace(
      /PRODUCT_BUNDLE_IDENTIFIER = /g,
      'PROVISIONING_PROFILE_SPECIFIER = "NonExistent Profile";\n\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = '
    );
    
    writeFileSync(pbxprojPath, content);
    logger.debug({ projectPath }, 'Injected provisioning profile error');
  }

  /**
   * Inject a missing dependency error into a Swift package
   */
  injectMissingDependency(packagePath: string) {
    const packageSwiftPath = join(packagePath, 'Package.swift');
    if (!existsSync(packageSwiftPath)) {
      throw new Error(`Package.swift not found: ${packageSwiftPath}`);
    }
    
    this.backupFile(packageSwiftPath);
    
    let content = readFileSync(packageSwiftPath, 'utf8');
    
    // In Swift Package Manager, the Package initializer arguments must be in order:
    // name, platforms?, products, dependencies?, targets
    // We need to insert dependencies after products but before targets
    
    // Find the end of products array and beginning of targets
    // Use [\s\S]*? for non-greedy multiline matching
    const regex = /(products:\s*\[[\s\S]*?\])(,\s*)(targets:)/;
    const match = content.match(regex);
    
    if (match) {
      // Insert dependencies between products and targets
      // Use a non-existent package to trigger dependency resolution error
      content = content.replace(
        regex,
        `$1,\n    dependencies: [\n        .package(url: "https://github.com/nonexistent-org/nonexistent-package.git", from: "1.0.0")\n    ]$2$3`
      );
    }
    
    // Now add the dependency to a target so it tries to use it
    // Find the first target that doesn't have dependencies yet
    const targetRegex = /\.target\(\s*name:\s*"([^"]+)"\s*\)/;
    const targetMatch = content.match(targetRegex);
    
    if (targetMatch) {
      const targetName = targetMatch[1];
      // Replace the target to add dependencies
      content = content.replace(
        targetMatch[0],
        `.target(\n            name: "${targetName}",\n            dependencies: [\n                .product(name: "NonExistentPackage", package: "nonexistent-package")\n            ])`
      );
      
      // Also add import to a source file to trigger the error at compile time
      const sourcePath = join(packagePath, 'Sources', targetName);
      if (existsSync(sourcePath)) {
        const sourceFiles = require('fs').readdirSync(sourcePath, { recursive: true })
          .filter((f: string) => f.endsWith('.swift'));
        
        if (sourceFiles.length > 0) {
          const sourceFile = join(sourcePath, sourceFiles[0]);
          this.backupFile(sourceFile);
          let sourceContent = readFileSync(sourceFile, 'utf8');
          sourceContent = 'import NonExistentPackage\n' + sourceContent;
          writeFileSync(sourceFile, sourceContent);
        }
      }
    }
    
    writeFileSync(packageSwiftPath, content);
    logger.debug({ packagePath }, 'Injected missing dependency error');
  }

  /**
   * Inject a platform compatibility error
   */
  injectPlatformError(projectPath: string) {
    const pbxprojPath = join(projectPath, 'project.pbxproj');
    if (!existsSync(pbxprojPath)) {
      throw new Error(`Project file not found: ${pbxprojPath}`);
    }
    
    this.backupFile(pbxprojPath);
    
    let content = readFileSync(pbxprojPath, 'utf8');
    
    // Set incompatible deployment targets
    content = content.replace(
      /IPHONEOS_DEPLOYMENT_TARGET = \d+\.\d+;/g,
      'IPHONEOS_DEPLOYMENT_TARGET = 99.0;' // Impossible iOS version
    );
    
    writeFileSync(pbxprojPath, content);
    logger.debug({ projectPath }, 'Injected platform compatibility error');
  }

  /**
   * Backup a file before modifying it
   */
  private backupFile(filePath: string) {
    if (!this.originalFiles.has(filePath)) {
      const content = readFileSync(filePath, 'utf8');
      this.originalFiles.set(filePath, content);
      logger.debug({ filePath }, 'Backed up original file');
    }
  }

  /**
   * Restore all modified files to their original state
   */
  restoreAll() {
    // Use git to reset all test_artifacts
    gitResetTestArtifacts();
    // Clear our tracking
    this.originalFiles.clear();
  }

  /**
   * Restore a specific file
   */
  restoreFile(filePath: string) {
    // Use git to reset the specific file
    gitResetFile(filePath);
    // Remove from our tracking
    this.originalFiles.delete(filePath);
  }
}