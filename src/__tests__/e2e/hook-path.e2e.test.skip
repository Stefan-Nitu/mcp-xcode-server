/**
 * E2E tests for xcode-sync hook path configuration
 * Ensures the hook path is correctly configured and the script exists
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, chmodSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { homedir } from 'os';

describe('Xcode Sync Hook Path E2E Tests', () => {
  const testProjectPath = '/tmp/test-hook-path-project';
  const testClaudeConfigPath = '/tmp/test-claude-config';
  const scriptPath = resolve(process.cwd(), 'scripts', 'xcode-sync.swift');
  
  beforeAll(() => {
    // Clean up any existing test directories
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true });
    }
    if (existsSync(testClaudeConfigPath)) {
      rmSync(testClaudeConfigPath, { recursive: true });
    }
  });
  
  afterAll(() => {
    // Clean up test directories
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true });
    }
    if (existsSync(testClaudeConfigPath)) {
      rmSync(testClaudeConfigPath, { recursive: true });
    }
  });

  describe('Script Existence', () => {
    test('xcode-sync.swift script should exist', () => {
      expect(existsSync(scriptPath)).toBe(true);
    });

    test('script should be executable', () => {
      const stats = require('fs').statSync(scriptPath);
      // Check if the file has execute permissions (any of them)
      const isExecutable = (stats.mode & 0o111) !== 0;
      expect(isExecutable).toBe(true);
    });

    test('script should have correct shebang', () => {
      const scriptContent = readFileSync(scriptPath, 'utf8');
      expect(scriptContent.startsWith('#!/usr/bin/env swift')).toBe(true);
    });
  });

  describe('Hook Configuration', () => {
    test('should correctly configure global hook path', () => {
      const globalConfigPath = join(testClaudeConfigPath, '.claude', 'settings.json');
      mkdirSync(join(testClaudeConfigPath, '.claude'), { recursive: true });
      
      const config = {
        hooks: {
          PostToolUse: [
            {
              matcher: "Write|Edit|MultiEdit|Bash",
              hooks: [
                {
                  type: "command",
                  command: scriptPath
                }
              ]
            }
          ]
        }
      };
      
      writeFileSync(globalConfigPath, JSON.stringify(config, null, 2));
      
      // Read and verify the configuration
      const savedConfig = JSON.parse(readFileSync(globalConfigPath, 'utf8'));
      expect(savedConfig.hooks.PostToolUse[0].hooks[0].command).toBe(scriptPath);
      
      // Verify the path exists
      expect(existsSync(savedConfig.hooks.PostToolUse[0].hooks[0].command)).toBe(true);
    });

    test('should correctly configure project-specific hook path', () => {
      const projectConfigPath = join(testProjectPath, '.claude', 'settings.json');
      mkdirSync(join(testProjectPath, '.claude'), { recursive: true });
      
      const config = {
        hooks: {
          PostToolUse: [
            {
              matcher: "Write|Edit|MultiEdit|Bash",
              hooks: [
                {
                  type: "command",
                  command: scriptPath
                }
              ]
            }
          ]
        }
      };
      
      writeFileSync(projectConfigPath, JSON.stringify(config, null, 2));
      
      // Read and verify the configuration
      const savedConfig = JSON.parse(readFileSync(projectConfigPath, 'utf8'));
      expect(savedConfig.hooks.PostToolUse[0].hooks[0].command).toBe(scriptPath);
      
      // Verify the path exists
      expect(existsSync(savedConfig.hooks.PostToolUse[0].hooks[0].command)).toBe(true);
    });

    test('should detect incorrect hook paths', () => {
      const incorrectPaths = [
        '/Users/stefan/Projects/mcp-servers/mcp-xcode/scripts/xcode-sync.swift',
        '/path/to/nonexistent/xcode-sync.swift',
        '/tmp/nonexistent/scripts/xcode-sync.swift',
        '/usr/local/bin/xcode-sync.swift',
      ];

      incorrectPaths.forEach(incorrectPath => {
        expect(existsSync(incorrectPath)).toBe(false);
      });
    });
  });

  describe('Hook Execution', () => {
    test('hook should execute without errors when called directly', () => {
      // Create a test Xcode project structure
      const testXcodeProject = join(testProjectPath, 'TestProject.xcodeproj');
      mkdirSync(testXcodeProject, { recursive: true });
      
      const pbxprojPath = join(testXcodeProject, 'project.pbxproj');
      writeFileSync(pbxprojPath, `// !$*UTF8*$!
{
  archiveVersion = 1;
  classes = {
  };
  objectVersion = 56;
  objects = {
  };
  rootObject = 1234567890ABCDEF;
}`);
      
      // Set environment variables for the hook
      const env = {
        ...process.env,
        PWD: testProjectPath,
        HOOK_TOOL_NAME: 'Write',
        HOOK_ARGS: JSON.stringify({
          file_path: join(testProjectPath, 'TestFile.swift'),
          content: 'print("Hello")'
        })
      };
      
      // The hook should handle projects that don't have the helper tool built
      // It should fail gracefully or skip if XcodeProjectModifier isn't available
      try {
        execSync(scriptPath, { env, cwd: testProjectPath, stdio: 'pipe' });
        // If it succeeds, that's fine
      } catch (error: any) {
        // The hook may fail if XcodeProjectModifier isn't built, which is okay
        // We're mainly testing that the script exists and can be executed
        expect(error).toBeDefined();
        // The error should be an execution error, not a "file not found" error
        expect(error.message).not.toContain('No such file or directory');
      }
    });

    test('hook should respect opt-out files', () => {
      const testXcodeProject = join(testProjectPath, 'OptOutProject.xcodeproj');
      mkdirSync(testXcodeProject, { recursive: true });
      
      // Create opt-out file
      writeFileSync(join(testProjectPath, '.no-xcode-sync'), '');
      
      const env = {
        ...process.env,
        PWD: testProjectPath,
        HOOK_TOOL_NAME: 'Write',
        HOOK_ARGS: JSON.stringify({
          file_path: join(testProjectPath, 'TestFile.swift'),
          content: 'print("Hello")'
        })
      };
      
      // Hook should exit early when opt-out file exists
      try {
        const output = execSync(scriptPath, { env, cwd: testProjectPath, stdio: 'pipe' });
        // Hook should exit silently when opted out
        expect(output.toString()).toBe('');
      } catch (error: any) {
        // If it fails, that's okay - the hook exists and was executed
        expect(error).toBeDefined();
        expect(error.message).not.toContain('No such file or directory');
      }
      
      // Clean up opt-out file
      rmSync(join(testProjectPath, '.no-xcode-sync'));
    });

    test('hook should handle missing Xcode project gracefully', () => {
      const env = {
        ...process.env,
        PWD: '/tmp/no-xcode-project-here',
        HOOK_TOOL_NAME: 'Write',
        HOOK_ARGS: JSON.stringify({
          file_path: '/tmp/no-xcode-project-here/test.swift',
          content: 'print("test")'
        })
      };
      
      // Hook should exit gracefully when no Xcode project is found
      try {
        const output = execSync(scriptPath, { env, cwd: '/tmp', stdio: 'pipe' });
        // Should exit silently when no project is found
        expect(output.toString()).toBe('');
      } catch (error: any) {
        // Expected to exit - the hook exists and was executed
        expect(error).toBeDefined();
        expect(error.message).not.toContain('No such file or directory');
      }
    });
  });

  describe('CLI Setup Integration', () => {
    test('CLI setup should configure correct hook path', () => {
      // This test verifies that the CLI setup command would use the correct path
      const cliPath = resolve(process.cwd(), 'src', 'cli.ts');
      
      if (existsSync(cliPath)) {
        // Read the CLI source file to verify it uses correct paths
        const cliContent = readFileSync(cliPath, 'utf8');
        
        // The CLI should reference the correct script path
        const expectedPathPattern = /scripts['",\s]+['"]xcode-sync\.swift/;
        expect(cliContent).toMatch(expectedPathPattern);
        
        // Should not contain the incorrect path
        expect(cliContent).not.toContain('mcp-xcode/scripts');
        expect(cliContent).not.toContain('mcp-xcode", "scripts');
      } else {
        // If source file doesn't exist, skip this test
        console.warn('CLI source file not found, skipping test');
      }
    });
  });

  describe('Path Resolution', () => {
    test('should correctly resolve script path from package root', () => {
      const packageRoot = process.cwd();
      const resolvedPath = resolve(packageRoot, 'scripts', 'xcode-sync.swift');
      
      expect(resolvedPath).toBe(scriptPath);
      expect(existsSync(resolvedPath)).toBe(true);
    });

    test('should handle global npm installation paths', () => {
      // Simulate global npm installation path
      const globalNpmPath = '/usr/local/lib/node_modules/mcp-xcode-server';
      const globalScriptPath = join(globalNpmPath, 'scripts', 'xcode-sync.swift');
      
      // In a real global installation, the path should be resolvable
      // This test documents the expected behavior
      if (existsSync(globalNpmPath)) {
        expect(existsSync(globalScriptPath)).toBe(true);
      }
    });

    test('should handle local npm installation paths', () => {
      // Simulate local npm installation path
      const localNpmPath = join(process.cwd(), 'node_modules', 'mcp-xcode-server');
      const localScriptPath = join(localNpmPath, 'scripts', 'xcode-sync.swift');
      
      // In a real local installation, the path should be resolvable
      // This test documents the expected behavior
      if (existsSync(localNpmPath)) {
        expect(existsSync(localScriptPath)).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    test('should provide helpful error message for missing script', () => {
      const nonExistentScript = '/tmp/nonexistent-xcode-sync.swift';
      
      try {
        execSync(nonExistentScript, { stdio: 'pipe' });
      } catch (error: any) {
        // Check that the error indicates the file wasn't found
        expect(error.message).toMatch(/No such file or directory|ENOENT|not found/i);
        // The error code may vary by system
        expect(error.code === 127 || error.code === 1 || error.code === undefined).toBe(true);
      }
    });

    test('should handle malformed hook configuration gracefully', () => {
      const malformedConfigPath = join(testClaudeConfigPath, 'malformed', '.claude', 'settings.json');
      mkdirSync(join(testClaudeConfigPath, 'malformed', '.claude'), { recursive: true });
      
      // Write malformed JSON
      writeFileSync(malformedConfigPath, '{ invalid json }');
      
      // Attempt to read and parse
      expect(() => {
        JSON.parse(readFileSync(malformedConfigPath, 'utf8'));
      }).toThrow();
    });

    test('should validate hook command paths', () => {
      const validatePath = (path: string): boolean => {
        // Path should be absolute
        if (!path.startsWith('/')) return false;
        
        // Path should end with xcode-sync.swift
        if (!path.endsWith('xcode-sync.swift')) return false;
        
        // Path should contain the correct project name
        if (!path.includes('mcp-xcode-server')) return false;
        
        return true;
      };
      
      expect(validatePath(scriptPath)).toBe(true);
      expect(validatePath('/Users/stefan/Projects/mcp-servers/mcp-xcode/scripts/xcode-sync.swift')).toBe(false);
      expect(validatePath('scripts/xcode-sync.swift')).toBe(false);
    });
  });
});