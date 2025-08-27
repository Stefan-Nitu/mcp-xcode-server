/**
 * Tests for the xcode-sync hook script
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('Xcode Sync Hook', () => {
  const testDir = '/tmp/test-xcode-hook';
  const projectDir = join(testDir, 'TestApp');
  const hookScript = join(process.cwd(), 'scripts', 'xcode-sync.swift');
  
  beforeAll(() => {
    // Clean up and create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    
    // Create a test Xcode project structure
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(join(projectDir, 'TestApp.xcodeproj'), { recursive: true });
    
    // Create a minimal project.pbxproj file
    const pbxprojContent = `// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 56;
	objects = {

/* Begin PBXBuildFile section */
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
		F86986901234567890ABCDEF /* TestApp.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = TestApp.app; sourceTree = BUILT_PRODUCTS_DIR; };
		F86986921234567890ABCDEF /* ContentView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ContentView.swift; sourceTree = "<group>"; };
/* End PBXFileReference section */

/* Begin PBXFrameworksBuildPhase section */
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
		F86986871234567890ABCDEF = {
			isa = PBXGroup;
			children = (
				F86986921234567890ABCDEF /* TestApp */,
				F86986911234567890ABCDEF /* Products */,
			);
			sourceTree = "<group>";
		};
		F86986911234567890ABCDEF /* Products */ = {
			isa = PBXGroup;
			children = (
				F86986901234567890ABCDEF /* TestApp.app */,
			);
			name = Products;
			sourceTree = "<group>";
		};
		F86986921234567890ABCDEF /* TestApp */ = {
			isa = PBXGroup;
			children = (
				F86986921234567890ABCDEF /* ContentView.swift */,
			);
			path = TestApp;
			sourceTree = "<group>";
		};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		F869868F1234567890ABCDEF /* TestApp */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = F869869F1234567890ABCDEF /* Build configuration list for PBXNativeTarget "TestApp" */;
			buildPhases = (
				F869868C1234567890ABCDEF /* Sources */,
				F869868D1234567890ABCDEF /* Frameworks */,
				F869868E1234567890ABCDEF /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
			);
			name = TestApp;
			productName = TestApp;
			productReference = F86986901234567890ABCDEF /* TestApp.app */;
			productType = "com.apple.product-type.application";
		};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		F86986881234567890ABCDEF /* Project object */ = {
			isa = PBXProject;
			attributes = {
				LastSwiftUpdateCheck = 1500;
			};
			buildConfigurationList = F869868B1234567890ABCDEF /* Build configuration list for PBXProject "TestApp" */;
			compatibilityVersion = "Xcode 14.0";
			developmentRegion = en;
			hasScannedForEncodings = 0;
			knownRegions = (
				en,
				Base,
			);
			mainGroup = F86986871234567890ABCDEF;
			productRefGroup = F86986911234567890ABCDEF /* Products */;
			projectDirPath = "";
			projectRoot = "";
			targets = (
				F869868F1234567890ABCDEF /* TestApp */,
			);
		};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
		F869868E1234567890ABCDEF /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
		F869868C1234567890ABCDEF /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXSourcesBuildPhase section */

	};
	rootObject = F86986881234567890ABCDEF /* Project object */;
}`;
    
    writeFileSync(
      join(projectDir, 'TestApp.xcodeproj', 'project.pbxproj'),
      pbxprojContent
    );
    
    // Build the XcodeProjectModifier if it doesn't exist
    if (!existsSync('/tmp/XcodeProjectModifier/.build/release/XcodeProjectModifier')) {
      try {
        mkdirSync('/tmp/XcodeProjectModifier/Sources/XcodeProjectModifier', { recursive: true });
        writeFileSync('/tmp/XcodeProjectModifier/Package.swift', `
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "XcodeProjectModifier",
    platforms: [.macOS(.v10_15)],
    dependencies: [
        .package(url: "https://github.com/tuist/XcodeProj.git", from: "8.0.0"),
        .package(url: "https://github.com/apple/swift-argument-parser", from: "1.0.0")
    ],
    targets: [
        .executableTarget(
            name: "XcodeProjectModifier",
            dependencies: [
                "XcodeProj",
                .product(name: "ArgumentParser", package: "swift-argument-parser")
            ]
        )
    ]
)`);
        
        // Copy the main.swift from test_artifacts if it exists
        const mainSwiftPath = join(process.cwd(), 'test_artifacts', 'XcodeProjectModifier', 'main.swift');
        if (existsSync(mainSwiftPath)) {
          const content = readFileSync(mainSwiftPath, 'utf-8');
          writeFileSync('/tmp/XcodeProjectModifier/Sources/XcodeProjectModifier/main.swift', content);
        } else {
          // Create a minimal stub for testing
          writeFileSync('/tmp/XcodeProjectModifier/Sources/XcodeProjectModifier/main.swift', `
import Foundation
print("Mock XcodeProjectModifier for testing")
exit(0)
`);
        }
        
        execSync('swift build -c release', { 
          cwd: '/tmp/XcodeProjectModifier',
          stdio: 'ignore' 
        });
      } catch (error) {
        console.warn('Could not build XcodeProjectModifier:', error);
      }
    }
  });
  
  afterAll(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });
  
  describe('Hook Data Parsing', () => {
    test('should parse Write tool data correctly', () => {
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: join(projectDir, 'TestApp', 'NewView.swift'),
          content: 'import SwiftUI\n\nstruct NewView: View {}'
        },
        tool_response: {
          type: 'create',
          filePath: join(projectDir, 'TestApp', 'NewView.swift')
        },
        cwd: projectDir
      };
      
      // Create the file first
      mkdirSync(join(projectDir, 'TestApp'), { recursive: true });
      writeFileSync(join(projectDir, 'TestApp', 'NewView.swift'), hookData.tool_input.content);
      
      // Run the hook script
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8',
        env: { ...process.env }
      });
      
      expect(result).toContain('Detected add operation');
      expect(result).toContain('NewView.swift');
    });
    
    test('should parse Edit tool data correctly', () => {
      const hookData = {
        tool_name: 'Edit',
        tool_input: {
          file_path: join(projectDir, 'TestApp', 'ExistingView.swift'),
          old_string: 'old content',
          new_string: 'new content'
        },
        tool_response: {
          type: 'update'
        },
        cwd: projectDir
      };
      
      // Create the file
      writeFileSync(join(projectDir, 'TestApp', 'ExistingView.swift'), 'new content');
      
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8',
        env: { ...process.env }
      });
      
      expect(result).toContain('Detected update operation for');
      expect(result).toContain('ExistingView.swift');
      expect(result).toContain('skipping Xcode sync');
    });
    
    test('should parse Bash rm command correctly', () => {
      const hookData = {
        tool_name: 'Bash',
        tool_input: {
          command: `rm ${join(projectDir, 'TestApp', 'DeletedView.swift')}`
        },
        tool_response: {
          stdout: '',
          stderr: ''
        },
        cwd: projectDir
      };
      
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8',
        env: { ...process.env }
      });
      
      expect(result).toContain('Detected remove operation');
      expect(result).toContain('DeletedView.swift');
    });
    
    test('should parse Bash touch command correctly', () => {
      const hookData = {
        tool_name: 'Bash',
        tool_input: {
          command: `touch ${join(projectDir, 'TestApp', 'TouchedView.swift')}`
        },
        tool_response: {
          stdout: '',
          stderr: ''
        },
        cwd: projectDir
      };
      
      // Create the file
      writeFileSync(join(projectDir, 'TestApp', 'TouchedView.swift'), '');
      
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8',
        env: { ...process.env }
      });
      
      expect(result).toContain('Detected add operation');
      expect(result).toContain('TouchedView.swift');
    });
    
    test('should parse Bash echo > command correctly', () => {
      const hookData = {
        tool_name: 'Bash',
        tool_input: {
          command: `echo 'content' > ${join(projectDir, 'TestApp', 'EchoView.swift')}`
        },
        tool_response: {
          stdout: '',
          stderr: ''
        },
        cwd: projectDir
      };
      
      // Create the file
      writeFileSync(join(projectDir, 'TestApp', 'EchoView.swift'), 'content');
      
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8',
        env: { ...process.env }
      });
      
      expect(result).toContain('Detected add operation');
      expect(result).toContain('EchoView.swift');
    });
  });
  
  describe('File Type Filtering', () => {
    test('should process Swift files', () => {
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: join(projectDir, 'TestApp', 'SwiftFile.swift')
        },
        tool_response: { type: 'create' },
        cwd: projectDir
      };
      
      writeFileSync(join(projectDir, 'TestApp', 'SwiftFile.swift'), '');
      
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8',
        env: { ...process.env }
      });
      
      expect(result).toContain('Detected add operation');
    });
    
    test('should process Markdown files', () => {
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: join(projectDir, 'README.md')
        },
        tool_response: { type: 'create' },
        cwd: projectDir
      };
      
      writeFileSync(join(projectDir, 'README.md'), '# Readme');
      
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8',
        env: { ...process.env }
      });
      
      expect(result).toContain('Detected add operation');
      expect(result).toContain('README.md');
    });
    
    test('should process resource files', () => {
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: join(projectDir, 'TestApp', 'config.json')
        },
        tool_response: { type: 'create' },
        cwd: projectDir
      };
      
      writeFileSync(join(projectDir, 'TestApp', 'config.json'), '{}');
      
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8',
        env: { ...process.env }
      });
      
      expect(result).toContain('Detected add operation');
      expect(result).toContain('config.json');
    });
    
    test('should ignore unsupported file types', () => {
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: join(projectDir, 'TestApp', 'data.bin')
        },
        tool_response: { type: 'create' },
        cwd: projectDir
      };
      
      writeFileSync(join(projectDir, 'TestApp', 'data.bin'), Buffer.from([0, 1, 2, 3]));
      
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8',
        env: { ...process.env }
      });
      
      expect(result).not.toContain('Detected add operation');
      expect(result).toBe(''); // Should exit early
    });
  });
  
  describe('Project Discovery', () => {
    test('should find Xcode project in parent directories', () => {
      // Create a nested directory structure
      const nestedDir = join(projectDir, 'TestApp', 'Views', 'Nested');
      mkdirSync(nestedDir, { recursive: true });
      
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: join(nestedDir, 'DeepView.swift')
        },
        tool_response: { type: 'create' },
        cwd: projectDir
      };
      
      writeFileSync(join(nestedDir, 'DeepView.swift'), '');
      
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8',
        env: { ...process.env }
      });
      
      // Handle macOS /tmp symlink to /private/tmp
      const expectedPath = join(projectDir, 'TestApp.xcodeproj');
      const privatePath = expectedPath.replace('/tmp/', '/private/tmp/');
      expect(result.includes(expectedPath) || result.includes(privatePath)).toBe(true);
      expect(result).toContain('Target: TestApp');
    });
    
    test('should exit if no Xcode project found', () => {
      const noProjectDir = join(testDir, 'NoProject');
      mkdirSync(noProjectDir, { recursive: true });
      
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: join(noProjectDir, 'File.swift')
        },
        tool_response: { type: 'create' },
        cwd: noProjectDir
      };
      
      writeFileSync(join(noProjectDir, 'File.swift'), '');
      
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8',
        env: { ...process.env }
      });
      
      expect(result).toContain('No Xcode project found');
    });
  });
  
  describe('Sync Opt-out', () => {
    test('should respect .no-xcode-sync file', () => {
      // Create opt-out file (testing new name)
      writeFileSync(join(projectDir, '.no-xcode-sync'), '');
      
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: join(projectDir, 'TestApp', 'OptedOut.swift')
        },
        tool_response: { type: 'create' },
        cwd: projectDir
      };
      
      writeFileSync(join(projectDir, 'TestApp', 'OptedOut.swift'), '');
      
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8',
        env: { ...process.env }
      });
      
      expect(result).toContain('Xcode sync is disabled for this project');
      
      // Clean up
      rmSync(join(projectDir, '.no-xcode-sync'));
    });
    
    test('should respect legacy .no-xcode-autoadd file', () => {
      // Create opt-out file (testing legacy name for backward compatibility)
      writeFileSync(join(projectDir, '.no-xcode-autoadd'), '');
      
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: join(projectDir, 'TestApp', 'OptedOut.swift')
        },
        tool_response: { type: 'create' },
        cwd: projectDir
      };
      
      writeFileSync(join(projectDir, 'TestApp', 'OptedOut.swift'), '');
      
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8',
        env: { ...process.env }
      });
      
      expect(result).toContain('Xcode sync is disabled for this project');
      
      // Clean up
      rmSync(join(projectDir, '.no-xcode-autoadd'));
    });
    
    test('should respect .claude/settings.json xcodeSync setting', () => {
      // Create .claude/settings.json with sync disabled
      const claudeDir = join(projectDir, '.claude');
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(
        join(claudeDir, 'settings.json'),
        JSON.stringify({ xcodeSync: false }, null, 2)
      );
      
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: join(projectDir, 'TestApp', 'DisabledBySettings.swift')
        },
        tool_response: { type: 'create' },
        cwd: projectDir
      };
      
      writeFileSync(join(projectDir, 'TestApp', 'DisabledBySettings.swift'), '');
      
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8',
        env: { ...process.env }
      });
      
      expect(result).toContain('Xcode sync is disabled for this project');
      
      // Clean up
      rmSync(claudeDir, { recursive: true });
    });
    
    test('should respect legacy .claude/settings.json xcodeAutoadd setting', () => {
      // Create .claude/settings.json with legacy autoadd disabled
      const claudeDir = join(projectDir, '.claude');
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(
        join(claudeDir, 'settings.json'),
        JSON.stringify({ xcodeAutoadd: false }, null, 2)
      );
      
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: join(projectDir, 'TestApp', 'DisabledByLegacy.swift')
        },
        tool_response: { type: 'create' },
        cwd: projectDir
      };
      
      writeFileSync(join(projectDir, 'TestApp', 'DisabledByLegacy.swift'), '');
      
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8',
        env: { ...process.env }
      });
      
      expect(result).toContain('Xcode sync is disabled for this project');
      
      // Clean up
      rmSync(claudeDir, { recursive: true });
    });
  });
  
  describe('Group Path Determination', () => {
    test('should determine correct group path for files in target directory', () => {
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: join(projectDir, 'TestApp', 'TargetFile.swift')
        },
        tool_response: { type: 'create' },
        cwd: projectDir
      };
      
      writeFileSync(join(projectDir, 'TestApp', 'TargetFile.swift'), '');
      
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8',
        env: { ...process.env }
      });
      
      expect(result).toContain('Group path: TestApp');
    });
    
    test('should determine correct group path for nested directories', () => {
      const viewsDir = join(projectDir, 'TestApp', 'Views');
      mkdirSync(viewsDir, { recursive: true });
      
      const hookData = {
        tool_name: 'Write',
        tool_input: {
          file_path: join(viewsDir, 'NestedView.swift')
        },
        tool_response: { type: 'create' },
        cwd: projectDir
      };
      
      writeFileSync(join(viewsDir, 'NestedView.swift'), '');
      
      const result = execSync(hookScript, {
        input: JSON.stringify(hookData),
        encoding: 'utf-8',
        env: { ...process.env }
      });
      
      expect(result).toContain('Group path: TestApp/Views');
    });
  });
});