#!/usr/bin/env node

/**
 * Demo script showing how to use the view_simulator_screen tool
 * to capture and view the current simulator screen
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { writeFileSync } from 'fs';

async function main() {
  // Create MCP client
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../dist/index.js'],
    cwd: process.cwd(),
  });
  
  const client = new Client({
    name: 'screenshot-demo',
    version: '1.0.0',
  }, {
    capabilities: {}
  });
  
  console.log('Connecting to MCP server...');
  await client.connect(transport);
  
  try {
    // List available simulators
    console.log('Listing simulators...');
    const listResponse = await client.request({
      method: 'tools/call',
      params: {
        name: 'list_simulators',
        arguments: {
          platform: 'iOS'
        }
      }
    }, CallToolResultSchema);
    
    const devices = JSON.parse(listResponse.content[0].text);
    console.log(`Found ${devices.length} iOS simulators`);
    
    const bootedDevice = devices.find(d => d.state === 'Booted');
    if (!bootedDevice) {
      console.log('No booted simulator found. Please boot a simulator first.');
      return;
    }
    
    console.log(`Using booted simulator: ${bootedDevice.name}`);
    
    // Capture the screen
    console.log('Capturing simulator screen...');
    const screenshotResponse = await client.request({
      method: 'tools/call',
      params: {
        name: 'view_simulator_screen',
        arguments: {
          deviceId: bootedDevice.udid
        }
      }
    }, CallToolResultSchema);
    
    // The response contains the image data
    const imageContent = screenshotResponse.content[0];
    if (imageContent.type === 'image') {
      console.log(`Screenshot captured! Image size: ${imageContent.data.length} bytes (base64)`);
      
      // Save to file for demonstration
      const buffer = Buffer.from(imageContent.data, 'base64');
      const filename = `simulator-screen-${Date.now()}.png`;
      writeFileSync(filename, buffer);
      console.log(`Screenshot saved to: ${filename}`);
      
      // In a real MCP client like Claude Code, the image would be displayed directly
      console.log('In an MCP client, this image would be displayed for viewing and analysis.');
    }
    
  } finally {
    await client.close();
    console.log('Disconnected from MCP server');
  }
}

main().catch(console.error);