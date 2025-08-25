/**
 * End-to-end tests for the xcode-sync hook
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, rmSync, copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';

describe('Xcode Sync Hook E2E', () => {
  const hookScript = join(process.cwd(), 'scripts', 'xcode-sync.swift');
  const testArtifactsDir = join(process.cwd(), 'test_artifacts');
  
  // Test projects
  const xcodeProjectPath = join(testArtifactsDir, 'TestProjectSwiftTesting');
  const xcodePbxproj = join(xcodeProjectPath, 'TestProjectSwiftTesting.xcodeproj', 'project.pbxproj');
  const xcodePbxprojBackup = `${xcodePbxproj}.backup`;
  
  const spmProjectPath = join(testArtifactsDir, 'TestSwiftPackageXCTest');
  
  beforeAll(() => {
    // Build XcodeProjectModifier if needed
    if (!existsSync('XcodeProjectModifier/.build/release/XcodeProjectModifier')) {
      execSync('npm run build:modifier', { stdio: 'inherit' });
    }
    
    // Backup Xcode project file
    if (existsSync(xcodePbxproj)) {
      copyFileSync(xcodePbxproj, xcodePbxprojBackup);
    }
  });
  
  afterAll(() => {
    // Restore Xcode project file
    if (existsSync(xcodePbxprojBackup)) {
      copyFileSync(xcodePbxprojBackup, xcodePbxproj);
      rmSync(xcodePbxprojBackup);
    }
  });
  
  afterEach(() => {
    // Restore project file after each test
    if (existsSync(xcodePbxprojBackup)) {
      copyFileSync(xcodePbxprojBackup, xcodePbxproj);
    }
    
    // Clean up test files
    const testFiles = [
      join(xcodeProjectPath, 'TestProjectSwiftTesting', 'TestFile.swift'),
      join(xcodeProjectPath, 'TestProjectSwiftTesting', 'ResourceFile.json'),
      join(xcodeProjectPath, 'TestProjectSwiftTesting', 'TouchedFile.swift'),
      join(xcodeProjectPath, 'TestProjectSwiftTesting', 'EchoFile.swift'),
      join(xcodeProjectPath, 'TestProjectSwiftTesting', 'FirstAdd.swift'),
      join(xcodeProjectPath, 'TestProjectSwiftTesting', 'File With Spaces.swift'),
      join(xcodeProjectPath, 'TestProjectSwiftTesting', 'test.xyz'),
      join(spmProjectPath, 'Sources', 'TestSwiftPackageXCTest', 'TestFile.swift'),
    ];
    
    testFiles.forEach(file => {
      if (existsSync(file)) {
        rmSync(file);
      }
    });
  });
  
  describe('Xcode Project Files', () => {
    test('should add Swift file to Xcode project', () => {
      const testFile = join(xcodeProjectPath, 'TestProjectSwiftTesting', 'TestFile.swift');
      const testContent = 'import Foundation\n\nstruct TestFile {}';
      
      // Create the file
      writeFileSync(testFile, testContent);
      
      // Create hook data
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: testFile,
          content: testContent
        },
        tool_response: {
          type: 'create'
        },
        cwd: xcodeProjectPath
      };
      
      // Run the hook
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8'
      });
      
      // Check output
      expect(result).toContain('Added TestFile.swift to project');
      
      // Verify the project file was modified
      const pbxprojContent = readFileSync(xcodePbxproj, 'utf-8');
      expect(pbxprojContent).toContain('TestFile.swift');
      
      // Count occurrences (should be multiple for different sections)
      const matches = pbxprojContent.match(/TestFile\.swift/g);
      expect(matches).toBeTruthy();
      expect(matches!.length).toBeGreaterThan(1);
    });
    
    test('should add resource file to Xcode project', () => {
      const testFile = join(xcodeProjectPath, 'TestProjectSwiftTesting', 'ResourceFile.json');
      const testContent = '{"key": "value"}';
      
      // Create the file
      writeFileSync(testFile, testContent);
      
      // Create hook data
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: testFile,
          content: testContent
        },
        tool_response: {
          type: 'create'
        },
        cwd: xcodeProjectPath
      };
      
      // Run the hook
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8'
      });
      
      // Check output
      expect(result).toContain('Added ResourceFile.json to project');
      
      // Verify the project file was modified
      const pbxprojContent = readFileSync(xcodePbxproj, 'utf-8');
      expect(pbxprojContent).toContain('ResourceFile.json');
    });
    
    test('should not add file when updating existing file', () => {
      const existingFile = join(xcodeProjectPath, 'TestProjectSwiftTesting', 'ContentView.swift');
      const originalContent = readFileSync(xcodePbxproj, 'utf-8');
      
      // Create hook data for edit operation
      const hookData = {
        tool_name: 'Edit',
        tool_input: {
          file_path: existingFile,
          old_string: 'struct ContentView',
          new_string: 'struct ContentView // Modified'
        },
        tool_response: {
          type: 'update'
        },
        cwd: xcodeProjectPath
      };
      
      // Run the hook
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8'
      });
      
      // Should not detect any operation for updates
      expect(result).not.toContain('Added');
      expect(result).not.toContain('Removed');
      
      // Project file should remain unchanged
      const newContent = readFileSync(xcodePbxproj, 'utf-8');
      expect(newContent).toBe(originalContent);
    });
  });
  
  describe('Swift Package Manager', () => {
    test('should NOT add file to Xcode project when file is in SPM', () => {
      // First check if SPM project has Package.swift
      const packageSwiftPath = join(spmProjectPath, 'Package.swift');
      expect(existsSync(packageSwiftPath)).toBe(true);
      
      const testFile = join(spmProjectPath, 'Sources', 'TestSPM', 'TestFile.swift');
      const testContent = 'import Foundation\n\nstruct TestFile {}';
      
      // Create directories if needed
      const sourceDir = join(spmProjectPath, 'Sources', 'TestSwiftPackageXCTest');
      if (!existsSync(sourceDir)) {
        mkdirSync(sourceDir, { recursive: true });
      }
      
      // Create the file
      writeFileSync(testFile, testContent);
      
      // Create hook data
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: testFile,
          content: testContent
        },
        tool_response: {
          type: 'create'
        },
        cwd: spmProjectPath
      };
      
      // Run the hook
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8'
      });
      
      // Should detect SPM and skip
      expect(result).toContain('File is part of a Swift Package - skipping Xcode project sync');
      
      // If there's an .xcodeproj in SPM (shouldn't be), it shouldn't be modified
      const spmXcodeProj = join(spmProjectPath, 'TestSwiftPackageXCTest.xcodeproj', 'project.pbxproj');
      if (existsSync(spmXcodeProj)) {
        const content = readFileSync(spmXcodeProj, 'utf-8');
        expect(content).not.toContain('TestFile.swift');
      }
    });
    
    test('should NOT add SPM files to Xcode project that contains a local Swift Package', () => {
      // Create a local Swift Package inside the Xcode project
      const localPackageDir = join(xcodeProjectPath, 'LocalPackage');
      const packageSwiftPath = join(localPackageDir, 'Package.swift');
      const sourcesDir = join(localPackageDir, 'Sources', 'LocalPackage');
      
      // Create Package.swift
      mkdirSync(localPackageDir, { recursive: true });
      writeFileSync(packageSwiftPath, `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "LocalPackage",
    products: [
        .library(name: "LocalPackage", targets: ["LocalPackage"]),
    ],
    targets: [
        .target(name: "LocalPackage"),
    ]
)`);
      
      // Create a Swift file in the local package
      mkdirSync(sourcesDir, { recursive: true });
      const spmFile = join(sourcesDir, 'LocalFeature.swift');
      writeFileSync(spmFile, 'public struct LocalFeature {}');
      
      // Create hook data for adding file to the local SPM
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: spmFile,
          content: 'public struct LocalFeature {}'
        },
        tool_response: {
          type: 'create'
        },
        cwd: xcodeProjectPath
      };
      
      // Run the hook
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8'
      });
      
      // Should detect that the file is in a Swift Package
      expect(result).toContain('File is part of a Swift Package - skipping Xcode project sync');
      
      // Verify the Xcode project file was NOT modified
      const pbxprojContent = readFileSync(xcodePbxproj, 'utf-8');
      expect(pbxprojContent).not.toContain('LocalFeature.swift');
      expect(pbxprojContent).not.toContain('LocalPackage');
      
      // Clean up
      rmSync(localPackageDir, { recursive: true, force: true });
    });
    
    test('should add regular files to Xcode project even when it contains local SPM', () => {
      // Create a local Swift Package inside the Xcode project
      const localPackageDir = join(xcodeProjectPath, 'LocalPackage');
      const packageSwiftPath = join(localPackageDir, 'Package.swift');
      
      mkdirSync(localPackageDir, { recursive: true });
      writeFileSync(packageSwiftPath, `// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "LocalPackage")`);
      
      // Now add a regular file (NOT in the SPM directory)
      const regularFile = join(xcodeProjectPath, 'TestProjectSwiftTesting', 'RegularFile.swift');
      writeFileSync(regularFile, 'struct RegularFile {}');
      
      // Create hook data for the regular file
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: regularFile,
          content: 'struct RegularFile {}'
        },
        tool_response: {
          type: 'create'
        },
        cwd: xcodeProjectPath
      };
      
      // Run the hook
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8'
      });
      
      // Should add the regular file normally
      expect(result).toContain('Added RegularFile.swift to project');
      
      // Verify the Xcode project file WAS modified
      const pbxprojContent = readFileSync(xcodePbxproj, 'utf-8');
      expect(pbxprojContent).toContain('RegularFile.swift');
      
      // Clean up
      rmSync(localPackageDir, { recursive: true, force: true });
      rmSync(regularFile);
    });
  });
  
  describe('Bash Commands', () => {
    test('should add file created with touch command', () => {
      const testFile = join(xcodeProjectPath, 'TestProjectSwiftTesting', 'TouchedFile.swift');
      
      // Create hook data for touch command
      const hookData = {
        tool_name: 'Bash',
        tool_input: {
          command: `touch "${testFile}"`
        },
        tool_response: {
          stdout: '',
          stderr: ''
        },
        cwd: xcodeProjectPath
      };
      
      // Create the file (simulating touch)
      writeFileSync(testFile, '');
      
      // Run the hook
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8'
      });
      
      // Check output
      expect(result).toContain('Detected add operation');
      expect(result).toContain('TouchedFile.swift');
      
      // Verify the project file was modified
      const pbxprojContent = readFileSync(xcodePbxproj, 'utf-8');
      expect(pbxprojContent).toContain('TouchedFile.swift');
      
      // Clean up
      rmSync(testFile);
    });
    
    test('should ignore non-file operations', () => {
      const originalContent = readFileSync(xcodePbxproj, 'utf-8');
      
      const commands = [
        'echo "Hello World"',  // No redirection
        'ls -la',
        'pwd',
        'git status',
        'npm install',
        'swift build',
        'ps aux',
        'date',
        'whoami'
      ];
      
      commands.forEach(command => {
        const hookData = {
          tool_name: 'Bash',
          tool_input: { command },
          tool_response: { stdout: 'some output' },
          cwd: xcodeProjectPath
        };
        
        const result = execSync(hookScript, {
          input: JSON.stringify(hookData),
          encoding: 'utf-8'
        });
        
        // Should not detect any file operations
        expect(result).not.toContain('Detected add operation');
        expect(result).not.toContain('Detected remove operation');
      });
      
      // Project file should remain unchanged
      const newContent = readFileSync(xcodePbxproj, 'utf-8');
      expect(newContent).toBe(originalContent);
    });
    
    test('should detect file creation with echo redirection', () => {
      const testFile = join(xcodeProjectPath, 'TestProjectSwiftTesting', 'EchoFile.swift');
      
      // Create hook data for echo with redirection
      const hookData = {
        tool_name: 'Bash',
        tool_input: {
          command: `echo "struct EchoFile {}" > "${testFile}"`
        },
        tool_response: {
          stdout: '',
          stderr: ''
        },
        cwd: xcodeProjectPath
      };
      
      // Create the file (simulating echo >)
      writeFileSync(testFile, 'struct EchoFile {}');
      
      // Run the hook
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8'
      });
      
      // Check output
      expect(result).toContain('Detected add operation');
      expect(result).toContain('EchoFile.swift');
      
      // Verify the project file was modified
      const pbxprojContent = readFileSync(xcodePbxproj, 'utf-8');
      expect(pbxprojContent).toContain('EchoFile.swift');
      
      // Clean up
      rmSync(testFile);
    });
  });
  
  describe('Duplicate Detection', () => {
    test('should NOT add file that is already in project', () => {
      // First add a file
      const testFile = join(xcodeProjectPath, 'TestProjectSwiftTesting', 'FirstAdd.swift');
      writeFileSync(testFile, 'struct FirstAdd {}');
      
      const hookData1 = {
        tool_name: 'Write',
        tool_input: { file_path: testFile, content: 'struct FirstAdd {}' },
        tool_response: { type: 'create' },
        cwd: xcodeProjectPath
      };
      
      // Add it once
      execSync(hookScript, {
        input: JSON.stringify(hookData1),
        encoding: 'utf-8'
      });
      
      // Verify it was added
      let pbxprojContent = readFileSync(xcodePbxproj, 'utf-8');
      const firstCount = (pbxprojContent.match(/FirstAdd\.swift/g) || []).length;
      expect(firstCount).toBeGreaterThan(0);
      
      // Try to add it again
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData1),
        encoding: 'utf-8'
      });
      
      // Should skip duplicate
      expect(result).toContain('File is already in the project - skipping');
      
      // Count should remain the same
      pbxprojContent = readFileSync(xcodePbxproj, 'utf-8');
      const secondCount = (pbxprojContent.match(/FirstAdd\.swift/g) || []).length;
      expect(secondCount).toBe(firstCount);
      
      // Clean up
      rmSync(testFile);
    });
  });
  
  describe('Edge Cases', () => {
    test('should handle files with spaces in names', () => {
      const testFile = join(xcodeProjectPath, 'TestProjectSwiftTesting', 'File With Spaces.swift');
      const testContent = 'import Foundation\n\nstruct FileWithSpaces {}';
      
      // Create the file
      writeFileSync(testFile, testContent);
      
      // Create hook data
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: testFile,
          content: testContent
        },
        tool_response: {
          type: 'create'
        },
        cwd: xcodeProjectPath
      };
      
      // Run the hook
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8'
      });
      
      // Check output
      expect(result).toContain('Added File With Spaces.swift to project');
      
      // Verify the project file was modified
      const pbxprojContent = readFileSync(xcodePbxproj, 'utf-8');
      expect(pbxprojContent).toContain('File With Spaces.swift');
      
      // Clean up
      rmSync(testFile);
    });
    
    test('should skip unsupported file types', () => {
      const testFile = join(xcodeProjectPath, 'TestProjectSwiftTesting', 'test.xyz');
      const originalContent = readFileSync(xcodePbxproj, 'utf-8');
      
      // Create the file
      writeFileSync(testFile, 'unsupported content');
      
      // Create hook data
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: testFile,
          content: 'content'
        },
        tool_response: {
          type: 'create'
        },
        cwd: xcodeProjectPath
      };
      
      // Run the hook
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8'
      });
      
      // Should not add unsupported file types
      expect(result).not.toContain('Added test.xyz');
      
      // Project file should remain unchanged
      const newContent = readFileSync(xcodePbxproj, 'utf-8');
      expect(newContent).toBe(originalContent);
      
      // Clean up
      rmSync(testFile);
    });
  });
});