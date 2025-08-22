import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';

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