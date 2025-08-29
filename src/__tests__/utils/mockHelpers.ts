/**
 * Mock helpers for unit testing
 * Provides utilities to mock subprocess execution, filesystem operations, and MCP interactions
 */

import { jest } from '@jest/globals';
import type { ExecSyncOptions } from 'child_process';

/**
 * Mock response builder for subprocess commands
 */
export class SubprocessMock {
  private responses = new Map<string, { stdout?: string; stderr?: string; error?: Error }>();

  /**
   * Register a mock response for a command pattern
   */
  mockCommand(pattern: string | RegExp, response: { stdout?: string; stderr?: string; error?: Error }) {
    const key = pattern instanceof RegExp ? pattern.source : pattern;
    this.responses.set(key, response);
  }

  /**
   * Get mock implementation for execSync
   */
  getExecSyncMock() {
    return jest.fn((command: string, options?: ExecSyncOptions) => {
      // Find matching response
      for (const [pattern, response] of this.responses) {
        const regex = new RegExp(pattern);
        if (regex.test(command)) {
          if (response.error) {
            throw response.error;
          }
          return response.stdout || '';
        }
      }
      throw new Error(`No mock defined for command: ${command}`);
    });
  }

  /**
   * Get mock implementation for spawn
   */
  getSpawnMock() {
    return jest.fn((command: string, args: string[], options?: any) => {
      const fullCommand = `${command} ${args.join(' ')}`;
      
      // Find matching response
      for (const [pattern, response] of this.responses) {
        const regex = new RegExp(pattern);
        if (regex.test(fullCommand)) {
          return {
            stdout: {
              on: jest.fn((event: string, cb: Function) => {
                if (event === 'data' && response.stdout) {
                  cb(Buffer.from(response.stdout));
                }
              })
            },
            stderr: {
              on: jest.fn((event: string, cb: Function) => {
                if (event === 'data' && response.stderr) {
                  cb(Buffer.from(response.stderr));
                }
              })
            },
            on: jest.fn((event: string, cb: Function) => {
              if (event === 'close') {
                cb(response.error ? 1 : 0);
              }
              if (event === 'error' && response.error) {
                cb(response.error);
              }
            }),
            kill: jest.fn()
          };
        }
      }
      
      throw new Error(`No mock defined for command: ${fullCommand}`);
    });
  }

  /**
   * Clear all mocked responses
   */
  clear() {
    this.responses.clear();
  }
}

/**
 * Mock filesystem operations
 */
export class FilesystemMock {
  private files = new Map<string, string | Buffer>();
  private directories = new Set<string>();

  /**
   * Mock a file with content
   */
  mockFile(path: string, content: string | Buffer) {
    this.files.set(path, content);
    // Also add parent directories
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      this.directories.add(parts.slice(0, i).join('/'));
    }
  }

  /**
   * Mock a directory
   */
  mockDirectory(path: string) {
    this.directories.add(path);
  }

  /**
   * Get mock for existsSync
   */
  getExistsSyncMock() {
    return jest.fn((path: string) => {
      return this.files.has(path) || this.directories.has(path);
    });
  }

  /**
   * Get mock for readFileSync
   */
  getReadFileSyncMock() {
    return jest.fn((path: string, encoding?: string) => {
      if (!this.files.has(path)) {
        const error: any = new Error(`ENOENT: no such file or directory, open '${path}'`);
        error.code = 'ENOENT';
        throw error;
      }
      const content = this.files.get(path)!;
      return encoding && content instanceof Buffer ? content.toString(encoding) : content;
    });
  }

  /**
   * Get mock for readdirSync
   */
  getReaddirSyncMock() {
    return jest.fn((path: string) => {
      if (!this.directories.has(path)) {
        const error: any = new Error(`ENOENT: no such file or directory, scandir '${path}'`);
        error.code = 'ENOENT';
        throw error;
      }
      
      // Return files and subdirectories in this directory
      const items = new Set<string>();
      const pathWithSlash = path.endsWith('/') ? path : `${path}/`;
      
      for (const file of this.files.keys()) {
        if (file.startsWith(pathWithSlash)) {
          const relative = file.slice(pathWithSlash.length);
          const firstPart = relative.split('/')[0];
          items.add(firstPart);
        }
      }
      
      for (const dir of this.directories) {
        if (dir.startsWith(pathWithSlash) && dir !== path) {
          const relative = dir.slice(pathWithSlash.length);
          const firstPart = relative.split('/')[0];
          items.add(firstPart);
        }
      }
      
      return Array.from(items);
    });
  }

  /**
   * Clear all mocked files and directories
   */
  clear() {
    this.files.clear();
    this.directories.clear();
  }
}

/**
 * Common mock responses for Xcode/simulator commands
 */
export const commonMockResponses = {
  /**
   * Mock successful xcodebuild
   */
  xcodebuildSuccess: (scheme: string = 'TestApp') => ({
    stdout: `Build succeeded\nScheme: ${scheme}\n** BUILD SUCCEEDED **`,
    stderr: ''
  }),

  /**
   * Mock xcodebuild failure
   */
  xcodebuildFailure: (error: string = 'Build failed') => ({
    stdout: '',
    stderr: `error: ${error}\n** BUILD FAILED **`,
    error: new Error(`Command failed: xcodebuild\n${error}`)
  }),

  /**
   * Mock scheme not found error
   */
  schemeNotFound: (scheme: string) => ({
    stdout: '',
    stderr: `xcodebuild: error: The project does not contain a scheme named "${scheme}".`,
    error: new Error(`xcodebuild: error: The project does not contain a scheme named "${scheme}".`)
  }),

  /**
   * Mock simulator list
   */
  simulatorList: (devices: Array<{ name: string; udid: string; state: string }> = []) => ({
    stdout: JSON.stringify({
      devices: {
        'com.apple.CoreSimulator.SimRuntime.iOS-17-0': devices.map(d => ({
          ...d,
          isAvailable: true,
          deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-15'
        }))
      }
    }),
    stderr: ''
  }),

  /**
   * Mock simulator boot success
   */
  simulatorBootSuccess: (deviceId: string) => ({
    stdout: `Device ${deviceId} booted successfully`,
    stderr: ''
  }),

  /**
   * Mock simulator already booted
   */
  simulatorAlreadyBooted: (deviceId: string) => ({
    stdout: '',
    stderr: `Device ${deviceId} is already booted`,
    error: new Error(`Device ${deviceId} is already booted`)
  }),

  /**
   * Mock app installation success
   */
  appInstallSuccess: (appPath: string, deviceId: string) => ({
    stdout: `Successfully installed ${appPath} on ${deviceId}`,
    stderr: ''
  }),

  /**
   * Mock list schemes
   */
  schemesList: (schemes: string[] = ['TestApp', 'TestAppTests']) => ({
    stdout: JSON.stringify({ project: { schemes: schemes } }),
    stderr: ''
  }),

  /**
   * Mock swift build success
   */
  swiftBuildSuccess: () => ({
    stdout: 'Building for debugging...\nBuild complete!',
    stderr: ''
  }),

  /**
   * Mock swift test success
   */
  swiftTestSuccess: (passed: number = 10, failed: number = 0) => ({
    stdout: `Test Suite 'All tests' passed at 2024-01-01\nExecuted ${passed + failed} tests, with ${failed} failures`,
    stderr: ''
  })
};

/**
 * Create a mock MCP client for testing
 */
export function createMockMCPClient() {
  return {
    request: jest.fn(),
    notify: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
  };
}

/**
 * Helper to setup common mocks for a test
 */
export function setupCommonMocks() {
  const subprocess = new SubprocessMock();
  const filesystem = new FilesystemMock();
  
  // Mock child_process
  jest.mock('child_process', () => ({
    execSync: subprocess.getExecSyncMock(),
    spawn: subprocess.getSpawnMock()
  }));
  
  // Mock fs
  jest.mock('fs', () => ({
    existsSync: filesystem.getExistsSyncMock(),
    readFileSync: filesystem.getReadFileSyncMock(),
    readdirSync: filesystem.getReaddirSyncMock()
  }));
  
  return { subprocess, filesystem };
}

/**
 * Helper to create a mock Xcode instance
 */
export function createMockXcode() {
  return {
    open: jest.fn().mockReturnValue({
      buildWithConfiguration: jest.fn().mockResolvedValue({
        success: true,
        stdout: 'Build succeeded',
        stderr: ''
      }),
      test: jest.fn().mockResolvedValue({
        success: true,
        stdout: 'Test succeeded',
        stderr: ''
      }),
      run: jest.fn().mockResolvedValue({
        success: true,
        stdout: 'Run succeeded',
        stderr: ''
      }),
      clean: jest.fn().mockResolvedValue({
        success: true,
        stdout: 'Clean succeeded',
        stderr: ''
      }),
      archive: jest.fn().mockResolvedValue({
        success: true,
        stdout: 'Archive succeeded',
        stderr: ''
      })
    })
  };
}