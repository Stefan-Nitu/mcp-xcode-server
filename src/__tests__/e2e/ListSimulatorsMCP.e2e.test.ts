/**
 * E2E Test for List Simulators through MCP Protocol
 *
 * Tests critical user journey: Listing simulators through MCP
 * Following testing philosophy: E2E tests for critical paths only (10%)
 *
 * NO MOCKS - Uses real MCP server, real simulators
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { createAndConnectClient, cleanupClientAndTransport } from '../utils/testHelpers.js';

describe('List Simulators MCP E2E', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    // Build the server
    const { execSync } = await import('child_process');
    execSync('npm run build', { stdio: 'inherit' });
  });

  beforeEach(async () => {
    ({ client, transport } = await createAndConnectClient());
  });

  afterEach(async () => {
    await cleanupClientAndTransport(client, transport);
  });

  it('should list simulators through MCP', async () => {
    // This tests the critical user journey:
    // User connects via MCP → calls list_simulators → receives result

    const result = await client.request(
      {
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {}
        }
      },
      CallToolResultSchema,
      { timeout: 30000 }
    );

    expect(result).toBeDefined();
    expect(result.content).toBeInstanceOf(Array);

    const textContent = result.content.find((c: any) => c.type === 'text') as { type: string; text: string } | undefined;
    expect(textContent).toBeDefined();

    const text = textContent?.text || '';
    if (text.includes('No simulators found')) {
      expect(text).toBe('⚠️ No simulators found');
    } else {
      expect(text).toMatch(/Found \d+ simulator/);
    }
  });

  it('should filter simulators by platform through MCP', async () => {
    const result = await client.request(
      {
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            platform: 'iOS'
          }
        }
      },
      CallToolResultSchema,
      { timeout: 30000 }
    );

    expect(result).toBeDefined();
    expect(result.content).toBeInstanceOf(Array);

    const textContent = result.content.find((c: any) => c.type === 'text') as { type: string; text: string } | undefined;
    const text = textContent?.text || '';

    if (!text.includes('No simulators found')) {
      const lines = text.split('\n');
      const deviceLines = lines.filter((line: string) =>
        line.includes('(') && line.includes(')') && line.includes('-')
      );

      for (const line of deviceLines) {
        expect(line).toMatch(/iPhone|iPad|iPod/);
      }
    }
  });

  it('should filter simulators by state through MCP', async () => {
    const result = await client.request(
      {
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            state: 'Shutdown'
          }
        }
      },
      CallToolResultSchema,
      { timeout: 30000 }
    );

    expect(result).toBeDefined();
    expect(result.content).toBeInstanceOf(Array);

    const textContent = result.content.find((c: any) => c.type === 'text') as { type: string; text: string } | undefined;
    const text = textContent?.text || '';

    if (!text.includes('No simulators found')) {
      const lines = text.split('\n');
      const deviceLines = lines.filter(line =>
        line.includes('(') && line.includes(')') && line.includes('-')
      );

      for (const line of deviceLines) {
        expect(line).toContain('Shutdown');
      }
    }
  });

  it('should handle combined filters through MCP', async () => {
    const result = await client.request(
      {
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            platform: 'iOS',
            state: 'Booted'
          }
        }
      },
      CallToolResultSchema,
      { timeout: 30000 }
    );

    expect(result).toBeDefined();
    expect(result.content).toBeInstanceOf(Array);

    const textContent = result.content.find((c: any) => c.type === 'text') as { type: string; text: string } | undefined;
    const text = textContent?.text || '';

    if (!text.includes('No simulators found')) {
      const lines = text.split('\n');
      const deviceLines = lines.filter(line =>
        line.includes('(') && line.includes(')') && line.includes('-')
      );

      for (const line of deviceLines) {
        expect(line).toMatch(/iPhone|iPad|iPod/);
        expect(line).toContain('Booted');
      }
    }
  });

  it('should validate invalid platform through MCP', async () => {
    const result = await client.request(
      {
        method: 'tools/call',
        params: {
          name: 'list_simulators',
          arguments: {
            platform: 'Android'
          }
        }
      },
      CallToolResultSchema,
      { timeout: 30000 }
    );

    expect(result).toBeDefined();
    expect(result.content).toBeInstanceOf(Array);

    const textContent = result.content.find((c: any) => c.type === 'text') as { type: string; text: string } | undefined;
    expect(textContent?.text).toContain('❌');
  });
});