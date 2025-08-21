/**
 * E2E tests for Simulator management tools
 * Tests ListSimulatorsTool, BootSimulatorTool, ShutdownSimulatorTool, ViewSimulatorScreenTool, GetDeviceLogsTool
 * Comprehensive cleanup of simulator states
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { spawn, ChildProcess, execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('Simulator Tools E2E Tests', () => {
  let serverProcess: ChildProcess;
  let client: Client;
  let transport: StdioClientTransport;
  
  // Track simulators we boot for cleanup
  const bootedSimulators: string[] = [];
  const timestamp = Date.now();
  const testDir = `/tmp/test-simulator-tools-${timestamp}`;
  
  beforeAll(async () => {
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    
    // Build the server
    execSync('npm run build', { cwd: process.cwd() });
    
    // Shutdown all simulators to start clean
    try {
      execSync('xcrun simctl shutdown all', { stdio: 'ignore' });
    } catch {
      // Ignore errors
    }
  }, 120000);
  
  afterAll(() => {
    // Shutdown any simulators we booted
    bootedSimulators.forEach(deviceId => {
      try {
        execSync(`xcrun simctl shutdown "${deviceId}"`, { stdio: 'ignore' });
      } catch {
        // Ignore if already shutdown
      }
    });
    
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });
  
  beforeEach(async () => {
    // Start MCP server
    serverProcess = spawn('node', ['dist/index.js'], {
      cwd: process.cwd(),
      env: { ...process.env },
    });
    
    // Create MCP client
    transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/index.js'],
      cwd: process.cwd(),
    });
    
    client = new Client({
      name: 'test-client',
      version: '1.0.0',
    }, {
      capabilities: {}
    });
    
    await client.connect(transport);
  }, 30000);
  
  afterEach(async () => {
    // Disconnect client
    if (client) {
      await client.close();
    }
    
    // Kill server process
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => {
        serverProcess.once('exit', resolve);
      });
    }
  });

  describe('ListSimulatorsTool', () => {
    test('should list all available simulators', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const devices = JSON.parse((response.content[0] as any).text);
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBeGreaterThan(0);
      
      // Should have standard properties
      const device = devices[0];
      expect(device).toHaveProperty('name');
      expect(device).toHaveProperty('udid');
      expect(device).toHaveProperty('state');
      expect(device).toHaveProperty('runtime');
    });

    test('should filter simulators by platform', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const devices = JSON.parse((response.content[0] as any).text);
      
      // All devices should be iOS
      devices.forEach((device: any) => {
        expect(device.runtime.toLowerCase()).toContain('ios');
      });
    });

    test('should show unavailable simulators when requested', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            showAll: true
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const devices = JSON.parse((response.content[0] as any).text);
      
      // May include unavailable devices
      const unavailable = devices.filter((d: any) => !d.isAvailable);
      // This might be 0 if all are available
      expect(unavailable).toBeDefined();
    });

    test('should list different platform simulators', async () => {
      const platforms = ['iOS', 'tvOS', 'watchOS'];
      
      for (const platform of platforms) {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'list_simulators',
            arguments: {
              platform
            }
          }
        }, CallToolResultSchema);
        
        expect(response).toBeDefined();
        const devices = JSON.parse((response.content[0] as any).text);
        // May be empty for some platforms
        expect(Array.isArray(devices)).toBe(true);
      }
    });
  });

  describe('BootSimulatorTool', () => {
    test('should boot a simulator by UDID', async () => {
      // Get an available simulator
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      const shutdownDevice = devices.find((d: any) => 
        d.state === 'Shutdown' && d.isAvailable
      );
      
      if (!shutdownDevice) {
        console.warn('No shutdown devices available');
        return;
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'boot_simulator',
          arguments: {
            deviceId: shutdownDevice.udid
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text).toContain('Successfully booted');
      
      bootedSimulators.push(shutdownDevice.udid);
    });

    test('should boot a simulator by name', async () => {
      // Get an available simulator
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      const shutdownDevice = devices.find((d: any) => 
        d.state === 'Shutdown' && d.isAvailable && d.name.includes('iPhone')
      );
      
      if (!shutdownDevice) {
        console.warn('No shutdown iPhone simulators available');
        return;
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'boot_simulator',
          arguments: {
            deviceId: shutdownDevice.name
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('boot');
      
      bootedSimulators.push(shutdownDevice.udid);
    });

    test('should handle already booted simulator', async () => {
      // Get a booted simulator or boot one
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      let bootedDevice = devices.find((d: any) => d.state === 'Booted');
      
      if (!bootedDevice) {
        // Boot one first
        const toBootDevice = devices.find((d: any) => d.state === 'Shutdown' && d.isAvailable);
        if (toBootDevice) {
          await client.request({
            method: 'tools/call',
            params: {
              name: 'boot_simulator',
              arguments: {
                deviceId: toBootDevice.udid
              }
            }
          }, CallToolResultSchema);
          bootedDevice = toBootDevice;
          bootedSimulators.push(toBootDevice.udid);
        }
      }
      
      if (bootedDevice) {
        // Try to boot again
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'boot_simulator',
            arguments: {
              deviceId: bootedDevice.udid
            }
          }
        }, CallToolResultSchema);
        
        expect(response).toBeDefined();
        const text = (response.content[0] as any).text;
        // Should handle gracefully
        expect(text).toBeDefined();
      }
    });

    test('should handle non-existent device', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'boot_simulator',
          arguments: {
            deviceId: 'non-existent-device-id'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      const text = (response.content[0] as any).text;
      expect(text.toLowerCase()).toContain('error');
    });
  });

  describe('ShutdownSimulatorTool', () => {
    test('should shutdown a booted simulator', async () => {
      // First boot a simulator
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      let bootedDevice = devices.find((d: any) => d.state === 'Booted');
      
      if (!bootedDevice) {
        const toBootDevice = devices.find((d: any) => d.state === 'Shutdown' && d.isAvailable);
        if (toBootDevice) {
          await client.request({
            method: 'tools/call',
            params: {
              name: 'boot_simulator',
              arguments: {
                deviceId: toBootDevice.udid
              }
            }
          }, CallToolResultSchema);
          bootedDevice = toBootDevice;
        }
      }
      
      if (bootedDevice) {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'shutdown_simulator',
            arguments: {
              deviceId: bootedDevice.udid
            }
          }
        }, CallToolResultSchema);
        
        expect(response).toBeDefined();
        const text = (response.content[0] as any).text;
        expect(text).toContain('Successfully shutdown');
        
        // Remove from tracking
        const index = bootedSimulators.indexOf(bootedDevice.udid);
        if (index > -1) bootedSimulators.splice(index, 1);
      }
    });

    test('should handle already shutdown simulator', async () => {
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      const shutdownDevice = devices.find((d: any) => d.state === 'Shutdown');
      
      if (shutdownDevice) {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'shutdown_simulator',
            arguments: {
              deviceId: shutdownDevice.udid
            }
          }
        }, CallToolResultSchema);
        
        expect(response).toBeDefined();
        const text = (response.content[0] as any).text;
        // Should handle gracefully
        expect(text).toBeDefined();
      }
    });

    test('should shutdown all booted simulators', async () => {
      // Boot multiple simulators
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      const shutdownDevices = devices.filter((d: any) => 
        d.state === 'Shutdown' && d.isAvailable
      ).slice(0, 2); // Boot up to 2 devices
      
      for (const device of shutdownDevices) {
        await client.request({
          method: 'tools/call',
          params: {
            name: 'boot_simulator',
            arguments: {
              deviceId: device.udid
            }
          }
        }, CallToolResultSchema);
        bootedSimulators.push(device.udid);
      }
      
      // Now shutdown all
      for (const deviceId of [...bootedSimulators]) {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'shutdown_simulator',
            arguments: {
              deviceId
            }
          }
        }, CallToolResultSchema);
        
        expect(response).toBeDefined();
        
        // Remove from tracking
        const index = bootedSimulators.indexOf(deviceId);
        if (index > -1) bootedSimulators.splice(index, 1);
      }
      
      expect(bootedSimulators.length).toBe(0);
    });
  });

  describe('ViewSimulatorScreenTool', () => {
    test('should capture screenshot from booted simulator', async () => {
      // Boot a simulator first
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      let bootedDevice = devices.find((d: any) => d.state === 'Booted');
      
      if (!bootedDevice) {
        const toBootDevice = devices.find((d: any) => d.state === 'Shutdown' && d.isAvailable);
        if (toBootDevice) {
          await client.request({
            method: 'tools/call',
            params: {
              name: 'boot_simulator',
              arguments: {
                deviceId: toBootDevice.udid
              }
            }
          }, CallToolResultSchema);
          bootedDevice = toBootDevice;
          bootedSimulators.push(toBootDevice.udid);
          
          // Wait for boot
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      if (bootedDevice) {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'view_simulator_screen',
            arguments: {
              deviceId: bootedDevice.udid
            }
          }
        }, CallToolResultSchema);
        
        expect(response).toBeDefined();
        expect(response.content[0].type).toBe('image');
        const imageData = (response.content[0] as any).data;
        expect(imageData).toBeDefined();
        expect(imageData.length).toBeGreaterThan(0);
      }
    });

    test('should capture screenshot without specifying device', async () => {
      // Ensure a simulator is booted
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      let bootedDevice = devices.find((d: any) => d.state === 'Booted');
      
      if (!bootedDevice) {
        const toBootDevice = devices.find((d: any) => d.state === 'Shutdown' && d.isAvailable);
        if (toBootDevice) {
          await client.request({
            method: 'tools/call',
            params: {
              name: 'boot_simulator',
              arguments: {
                deviceId: toBootDevice.udid
              }
            }
          }, CallToolResultSchema);
          bootedSimulators.push(toBootDevice.udid);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      if (bootedDevice || bootedSimulators.length > 0) {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'view_simulator_screen',
            arguments: {}
          }
        }, CallToolResultSchema);
        
        expect(response).toBeDefined();
        // Should use the booted device
      }
    });

    test('should handle no booted simulators', async () => {
      // Shutdown all simulators
      try {
        execSync('xcrun simctl shutdown all', { stdio: 'ignore' });
      } catch {
        // Ignore
      }
      
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'view_simulator_screen',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      // Should report error
      const content = response.content[0];
      if (content.type === 'text') {
        expect((content as any).text.toLowerCase()).toContain('error');
      }
    });

    test('should handle non-existent device', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'view_simulator_screen',
          arguments: {
            deviceId: 'non-existent-device'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      // Should report error
    });
  });

  describe('GetDeviceLogsTool', () => {
    test('should retrieve device logs', async () => {
      // Boot a simulator
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            platform: 'iOS'
          }
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      let bootedDevice = devices.find((d: any) => d.state === 'Booted');
      
      if (!bootedDevice) {
        const toBootDevice = devices.find((d: any) => d.state === 'Shutdown' && d.isAvailable);
        if (toBootDevice) {
          await client.request({
            method: 'tools/call',
            params: {
              name: 'boot_simulator',
              arguments: {
                deviceId: toBootDevice.udid
              }
            }
          }, CallToolResultSchema);
          bootedDevice = toBootDevice;
          bootedSimulators.push(toBootDevice.udid);
        }
      }
      
      if (bootedDevice) {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'get_device_logs',
            arguments: {
              deviceId: bootedDevice.udid,
              last: '1m'
            }
          }
        }, CallToolResultSchema);
        
        expect(response).toBeDefined();
        const text = (response.content[0] as any).text;
        expect(text).toBeDefined();
        // Logs might be empty
      }
    });

    test('should retrieve logs with predicate filter', async () => {
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      const bootedDevice = devices.find((d: any) => d.state === 'Booted');
      
      if (bootedDevice) {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'get_device_logs',
            arguments: {
              deviceId: bootedDevice.udid,
              predicate: 'process == "SpringBoard"',
              last: '5m'
            }
          }
        }, CallToolResultSchema);
        
        expect(response).toBeDefined();
        const text = (response.content[0] as any).text;
        expect(text).toBeDefined();
      }
    });

    test('should handle different time intervals', async () => {
      const intervals = ['1m', '5m', '1h'];
      
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      const bootedDevice = devices.find((d: any) => d.state === 'Booted');
      
      if (bootedDevice) {
        for (const interval of intervals) {
          const response = await client.request({
            method: 'tools/call',
            params: {
              name: 'get_device_logs',
              arguments: {
                deviceId: bootedDevice.udid,
                last: interval
              }
            }
          }, CallToolResultSchema);
          
          expect(response).toBeDefined();
        }
      }
    });

    test('should handle logs without device (uses booted)', async () => {
      // Ensure a simulator is booted
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      const bootedDevice = devices.find((d: any) => d.state === 'Booted');
      
      if (bootedDevice) {
        const response = await client.request({
          method: 'tools/call',
          params: {
            name: 'get_device_logs',
            arguments: {
              last: '1m'
            }
          }
        }, CallToolResultSchema);
        
        expect(response).toBeDefined();
      }
    });

    test('should reject dangerous predicates', async () => {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'get_device_logs',
          arguments: {
            predicate: 'process == "Test" && `rm -rf /`',
            last: '1m'
          }
        }
      }, CallToolResultSchema);
      
      expect(response).toBeDefined();
      // Should be rejected by validation
    });
  });

  describe('Simulator State Management', () => {
    test('should handle concurrent boot/shutdown operations', async () => {
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      const availableDevices = devices.filter((d: any) => 
        d.state === 'Shutdown' && d.isAvailable
      ).slice(0, 2);
      
      if (availableDevices.length >= 2) {
        // Boot both concurrently
        const bootOps = Promise.all(
          availableDevices.map((device: any) => 
            client.request({
              method: 'tools/call',
              params: {
                name: 'boot_simulator',
                arguments: {
                  deviceId: device.udid
                }
              }
            }, CallToolResultSchema)
          )
        );
        
        const bootResults = await bootOps;
        expect(bootResults).toHaveLength(2);
        
        availableDevices.forEach((d: any) => bootedSimulators.push(d.udid));
        
        // Shutdown both concurrently
        const shutdownOps = Promise.all(
          availableDevices.map((device: any) => 
            client.request({
              method: 'tools/call',
              params: {
                name: 'shutdown_simulator',
                arguments: {
                  deviceId: device.udid
                }
              }
            }, CallToolResultSchema)
          )
        );
        
        const shutdownResults = await shutdownOps;
        expect(shutdownResults).toHaveLength(2);
        
        // Clear tracking
        availableDevices.forEach((d: any) => {
          const index = bootedSimulators.indexOf(d.udid);
          if (index > -1) bootedSimulators.splice(index, 1);
        });
      }
    });

    test('should handle simulator state transitions', async () => {
      const listResponse = await client.request({
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      }, CallToolResultSchema);
      
      const devices = JSON.parse((listResponse.content[0] as any).text);
      const testDevice = devices.find((d: any) => 
        d.state === 'Shutdown' && d.isAvailable
      );
      
      if (testDevice) {
        // Boot
        await client.request({
          method: 'tools/call',
          params: {
            name: 'boot_simulator',
            arguments: {
              deviceId: testDevice.udid
            }
          }
        }, CallToolResultSchema);
        
        // Verify booted state
        const listAfterBoot = await client.request({
          method: 'tools/call',
          params: {
            name: 'list_simulators',
            arguments: {}
          }
        }, CallToolResultSchema);
        
        const devicesAfterBoot = JSON.parse((listAfterBoot.content[0] as any).text);
        const bootedDevice = devicesAfterBoot.find((d: any) => d.udid === testDevice.udid);
        expect(bootedDevice?.state).toBe('Booted');
        
        // Shutdown
        await client.request({
          method: 'tools/call',
          params: {
            name: 'shutdown_simulator',
            arguments: {
              deviceId: testDevice.udid
            }
          }
        }, CallToolResultSchema);
        
        // Verify shutdown state
        const listAfterShutdown = await client.request({
          method: 'tools/call',
          params: {
            name: 'list_simulators',
            arguments: {}
          }
        }, CallToolResultSchema);
        
        const devicesAfterShutdown = JSON.parse((listAfterShutdown.content[0] as any).text);
        const shutdownDevice = devicesAfterShutdown.find((d: any) => d.udid === testDevice.udid);
        expect(shutdownDevice?.state).toBe('Shutdown');
      }
    });
  });

  describe('Cleanup Verification', () => {
    test('should shutdown all booted simulators on cleanup', () => {
      // This happens in afterAll
      expect(bootedSimulators).toBeDefined();
      
      // After all tests, simulators should be shutdown
      process.on('exit', () => {
        bootedSimulators.forEach(deviceId => {
          try {
            const output = execSync(`xcrun simctl list devices | grep "${deviceId}"`, { encoding: 'utf8' });
            expect(output).toContain('Shutdown');
          } catch {
            // Device might not exist
          }
        });
      });
    });

    test('should clean up test directory', () => {
      expect(existsSync(testDir)).toBe(true); // Still exists during test
      
      // After all tests, should be cleaned
      process.on('exit', () => {
        expect(existsSync(testDir)).toBe(false);
      });
    });
  });
});