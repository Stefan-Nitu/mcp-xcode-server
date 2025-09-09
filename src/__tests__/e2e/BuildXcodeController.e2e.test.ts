/**
 * E2E Test for BuildXcodeController
 * 
 * Tests BEHAVIOR with REAL xcodebuild:
 * - Can the controller actually build real projects?
 * - Do the destination mappings produce valid xcodebuild commands that work?
 * - Does error handling work with real build failures?
 * 
 * NO MOCKS - uses real xcodebuild with test projects
 * Direct controller calls - does NOT test through MCP protocol
 */

import { BuildXcodeController } from '../../presentation/controllers/BuildXcodeController.js';
import { createBuildXcodeTool } from '../../factories/BuildXcodeControllerFactory.js';
import { TestProjectManager } from '../utils/TestProjectManager.js';
import * as fs from 'fs';

describe('BuildXcodeController E2E', () => {
  let controller: BuildXcodeController;
  let testManager: TestProjectManager;
  
  beforeAll(async () => {
    testManager = new TestProjectManager();
    await testManager.setup();
  });
  
  afterAll(async () => {
    await testManager.cleanup();
  });
  
  beforeEach(() => {
    // Create controller with all real dependencies
    controller = createBuildXcodeTool();
  });

  describe('build real Xcode projects', () => {
    it('should successfully build iOS test project', async () => {
      // This tests that:
      // 1. Destination 'iOSSimulator' produces a valid xcodebuild command
      // 2. The entire stack can handle real xcodebuild output
      // 3. Success is properly detected and reported
      
      const result = await controller.execute({
        projectPath: testManager.paths.xcodeProjectXCTestPath,
        scheme: 'TestProjectXCTest',
        destination: 'iOSSimulator'
      });

      // Should report success
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Build succeeded')
          })
        ])
      });
    }, 60000); // Real builds can take time

    it('should successfully build macOS test project', async () => {
      // This tests macOS destination mapping works
      const result = await controller.execute({
        projectPath: testManager.paths.xcodeProjectXCTestPath,
        scheme: 'TestProjectXCTest',
        destination: 'macOS'
      });

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Build succeeded')
          })
        ])
      });
    }, 60000);

    it('should build with Release configuration', async () => {
      // This tests configuration is properly passed through
      const result = await controller.execute({
        projectPath: testManager.paths.xcodeProjectXCTestPath,
        scheme: 'TestProjectXCTest',
        destination: 'iOSSimulator',
        configuration: 'Release'
      });

      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Build succeeded')
          })
        ])
      });
      
      // Should mention Release configuration
      expect(result.content[0].text).toContain('Release');
    }, 60000);

    it('should handle custom derived data path', async () => {
      // This tests that derived data path is properly used
      const customPath = `/tmp/TestDerivedData_${Date.now()}`;
      
      const result = await controller.execute({
        projectPath: testManager.paths.xcodeProjectXCTestPath,
        scheme: 'TestProjectXCTest',
        destination: 'iOSSimulator',
        derivedDataPath: customPath
      });

      expect(result.content[0].text).toContain('Build succeeded');
      
      // Derived data should exist at custom path
      expect(fs.existsSync(customPath)).toBe(true);
      
      // Cleanup
      fs.rmSync(customPath, { recursive: true, force: true });
    }, 60000);
  });

  describe('handle real build failures', () => {
    it('should report error for non-existent scheme', async () => {
      // This tests real xcodebuild error handling
      const result = await controller.execute({
        projectPath: testManager.paths.xcodeProjectXCTestPath,
        scheme: 'NonExistentScheme',
        destination: 'iOSSimulator'
      });

      // Should report failure
      expect(result.content[0].text).toContain('Build failed');
      
      // Should include the actual xcodebuild error about the missing scheme
      expect(result.content[0].text).toContain('does not contain a scheme named "NonExistentScheme"');
    }, 60000);

    it('should handle invalid platform for project', async () => {
      // Try to build a macOS-only project for iOS (if we have one)
      // or iOS-only project for watchOS
      const result = await controller.execute({
        projectPath: testManager.paths.xcodeProjectXCTestPath,
        scheme: 'TestProjectXCTest',
        destination: 'watchOSSimulator'
      });

      // Should handle the failure gracefully
      expect(result.content[0].text).toContain('Build failed');
    }, 60000);
  });

  describe('build for all supported platforms', () => {
    it('should attempt to build for tvOS simulator', async () => {
      const result = await controller.execute({
        projectPath: testManager.paths.xcodeProjectXCTestPath,
        scheme: 'TestProjectXCTest',
        destination: 'tvOSSimulator'
      });

      // Should complete without throwing
      expect(result.content[0].text).toBeDefined();
      // Should mention tvOS in the result
      expect(result.content[0].text.toLowerCase()).toContain('tvos');
    }, 60000);

    it('should attempt to build for watchOS simulator', async () => {
      const result = await controller.execute({
        projectPath: testManager.paths.xcodeProjectXCTestPath,
        scheme: 'TestProjectXCTest',
        destination: 'watchOSSimulator'
      });

      // Should complete without throwing
      expect(result.content[0].text).toBeDefined();
      // Should mention watchOS in the result
      expect(result.content[0].text.toLowerCase()).toContain('watchos');
    }, 60000);

    it('should attempt to build for visionOS simulator', async () => {
      const result = await controller.execute({
        projectPath: testManager.paths.xcodeProjectXCTestPath,
        scheme: 'TestProjectXCTest',
        destination: 'visionOSSimulator'
      });

      // Should complete without throwing
      expect(result.content[0].text).toBeDefined();
      // Should mention visionOS or xrOS (internal name) in the result
      expect(result.content[0].text.toLowerCase()).toMatch(/visionos|xros/);
    }, 60000);

    it('should build for iOS device', async () => {
      const result = await controller.execute({
        projectPath: testManager.paths.xcodeProjectXCTestPath,
        scheme: 'TestProjectXCTest',
        destination: 'iOSDevice'
      });

      // Should complete without throwing
      expect(result.content[0].text).toBeDefined();
      // Should show it's building for iOS platform
      expect(result.content[0].text).toContain('Platform: iOS');
    }, 60000);

    it('should attempt to build for tvOS device', async () => {
      const result = await controller.execute({
        projectPath: testManager.paths.xcodeProjectXCTestPath,
        scheme: 'TestProjectXCTest',
        destination: 'tvOSDevice'
      });

      // Should complete without throwing
      expect(result.content[0].text).toBeDefined();
      // Should mention tvOS in the result
      expect(result.content[0].text.toLowerCase()).toContain('tvos');
    }, 60000);

    it('should attempt to build for watchOS device', async () => {
      const result = await controller.execute({
        projectPath: testManager.paths.xcodeProjectXCTestPath,
        scheme: 'TestProjectXCTest',
        destination: 'watchOSDevice'
      });

      // Should complete without throwing
      expect(result.content[0].text).toBeDefined();
      // Should mention watchOS in the result
      expect(result.content[0].text.toLowerCase()).toContain('watchos');
    }, 60000);

    it('should build for visionOS device', async () => {
      const result = await controller.execute({
        projectPath: testManager.paths.xcodeProjectXCTestPath,
        scheme: 'TestProjectXCTest',
        destination: 'visionOSDevice'
      });

      // Should complete without throwing
      expect(result.content[0].text).toBeDefined();
      // Should mention visionOS or xrOS in the result
      expect(result.content[0].text.toLowerCase()).toMatch(/visionos|xros/);
    }, 60000);
  });

  describe('input validation', () => {
    it('should reject non-Xcode project files', async () => {
      const result = await controller.execute({
        projectPath: '/tmp/readme.txt',
        scheme: 'SomeScheme',
        destination: 'iOSSimulator'
      });
      
      // Tool returns an error response rather than throwing
      expect(result.content[0].text).toBe('❌ Project path must be an .xcodeproj or .xcworkspace file');
    });

    it('should reject empty scheme', async () => {
      const result = await controller.execute({
        projectPath: testManager.paths.xcodeProjectXCTestPath,
        scheme: '',
        destination: 'iOSSimulator'
      });
      
      // Tool returns formatted error response
      const expected = 
`❌ Validation errors:
  • Scheme is required
  • Scheme cannot be empty or whitespace`;
      expect(result.content[0].text).toBe(expected);
    });

    it('should reject invalid destination', async () => {
      const result = await controller.execute({
        projectPath: testManager.paths.xcodeProjectXCTestPath,
        scheme: 'TestProjectXCTest',
        destination: 'Android'
      });
      
      // Tool returns formatted error response
      expect(result.content[0].text).toBe('❌ Invalid destination. Use format: [platform][Simulator|Device|SimulatorUniversal]');
    });
  });
});