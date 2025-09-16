import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Cleanup MCP client and transport connections
 */
export async function cleanupClientAndTransport(
  client: Client | null | undefined,
  transport: StdioClientTransport | null | undefined
): Promise<void> {
  if (client) {
    await client.close();
  }
  
  if (transport) {
    const transportProcess = (transport as any)._process;
    await transport.close();
    
    if (transportProcess) {
      if (transportProcess.stdin && !transportProcess.stdin.destroyed) {
        transportProcess.stdin.end();
        transportProcess.stdin.destroy();
      }
      if (transportProcess.stdout && !transportProcess.stdout.destroyed) {
        transportProcess.stdout.destroy();
      }
      if (transportProcess.stderr && !transportProcess.stderr.destroyed) {
        transportProcess.stderr.destroy();
      }
      transportProcess.unref();
      if (!transportProcess.killed) {
        transportProcess.kill('SIGTERM');
        await new Promise(resolve => {
          const timeout = setTimeout(resolve, 100);
          transportProcess.once('exit', () => {
            clearTimeout(timeout);
            resolve(undefined);
          });
        });
      }
    }
  }
}

/**
 * Create and connect a new MCP client and transport
 */
export async function createAndConnectClient(): Promise<{
  client: Client;
  transport: StdioClientTransport;
}> {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    cwd: process.cwd(),
  });
  
  const client = new Client({
    name: 'test-client',
    version: '1.0.0',
  }, {
    capabilities: {}
  });
  
  await client.connect(transport);
  
  return { client, transport };
}

/**
 * Wait for a simulator to reach the Booted state
 * @param simulatorId The simulator UUID to wait for
 * @param maxSeconds Maximum seconds to wait (default 30)
 * @returns Promise that resolves when booted or rejects on timeout
 */
export async function waitForSimulatorBoot(
  simulatorId: string,
  maxSeconds: number = 30
): Promise<void> {
  for (let i = 0; i < maxSeconds; i++) {
    const listResult = await execAsync('xcrun simctl list devices --json');
    const devices = JSON.parse(listResult.stdout);

    for (const runtime of Object.values(devices.devices) as any[]) {
      const device = runtime.find((d: any) => d.udid === simulatorId);
      if (device && device.state === 'Booted') {
        return; // Successfully booted
      }
    }

    // Wait 1 second before trying again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Failed to boot simulator ${simulatorId} after ${maxSeconds} seconds`);
}

/**
 * Boot a simulator and wait for it to be ready
 * @param simulatorId The simulator UUID to boot
 * @param maxSeconds Maximum seconds to wait (default 30)
 */
export async function bootAndWaitForSimulator(
  simulatorId: string,
  maxSeconds: number = 30
): Promise<void> {
  try {
    await execAsync(`xcrun simctl boot "${simulatorId}"`);
  } catch {
    // Ignore if already booted
  }

  await waitForSimulatorBoot(simulatorId, maxSeconds);
}

/**
 * Wait for a simulator to reach the Shutdown state
 * @param simulatorId The simulator UUID to wait for
 * @param maxSeconds Maximum seconds to wait (default 30)
 * @returns Promise that resolves when shutdown or rejects on timeout
 */
export async function waitForSimulatorShutdown(
  simulatorId: string,
  maxSeconds: number = 30
): Promise<void> {
  for (let i = 0; i < maxSeconds; i++) {
    const listResult = await execAsync('xcrun simctl list devices --json');
    const devices = JSON.parse(listResult.stdout);

    for (const runtime of Object.values(devices.devices) as any[]) {
      const device = runtime.find((d: any) => d.udid === simulatorId);
      if (device && device.state === 'Shutdown') {
        return; // Successfully shutdown
      }
    }

    // Wait 1 second before trying again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Failed to shutdown simulator ${simulatorId} after ${maxSeconds} seconds`);
}

/**
 * Shutdown a simulator and wait for it to be shutdown
 * @param simulatorId The simulator UUID to shutdown
 * @param maxSeconds Maximum seconds to wait (default 30)
 */
export async function shutdownAndWaitForSimulator(
  simulatorId: string,
  maxSeconds: number = 30
): Promise<void> {
  try {
    await execAsync(`xcrun simctl shutdown "${simulatorId}"`);
  } catch {
    // Ignore if already shutdown
  }

  await waitForSimulatorShutdown(simulatorId, maxSeconds);
}

/**
 * Cleanup a test simulator by shutting it down and deleting it
 * @param simulatorId The simulator UUID to cleanup
 */
export async function cleanupTestSimulator(simulatorId: string | undefined): Promise<void> {
  if (!simulatorId) return;

  try {
    await execAsync(`xcrun simctl shutdown "${simulatorId}"`);
  } catch {
    // Ignore shutdown errors - simulator might already be shutdown
  }

  try {
    await execAsync(`xcrun simctl delete "${simulatorId}"`);
  } catch {
    // Ignore delete errors - simulator might already be deleted
  }
}

