#!/usr/bin/env node

import { program } from 'commander';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { execSync } from 'child_process';
import * as readline from 'readline/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = resolve(__dirname, '..');

interface ClaudeConfig {
  mcpServers?: Record<string, any>;
  hooks?: any;
}

class MCPXcodeSetup {
  private rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  async setup() {
    console.log('🔧 MCP Xcode Setup\n');
    
    // 1. Determine installation scope
    const scope = await this.askScope();
    
    // 2. Set up MCP server
    await this.setupMCPServer(scope);
    
    // 3. Ask about hooks
    if (scope === 'global') {
      console.log('\n📝 Auto-add Hook Information:');
      console.log('The global hook will automatically add Swift files to Xcode projects.');
      console.log('It only runs when:');
      console.log('  - A .swift file is created');
      console.log('  - An .xcodeproj file exists in the parent directories');
      console.log('  - The project hasn\'t opted out (via .no-xcode-autoadd file)');
    }
    
    const setupHooks = await this.askYesNo('Would you like to enable auto-add for Swift files? (recommended)');
    if (setupHooks) {
      await this.setupHooks(scope);
    }
    
    // 4. Build helper tools
    console.log('\n📦 Building helper tools...');
    await this.buildHelperTools();
    
    console.log('\n✅ Setup complete!');
    console.log('\nNext steps:');
    console.log('1. Restart Claude Code for changes to take effect');
    if (scope === 'project') {
      console.log('2. Commit .claude/settings.json to share with your team');
    }
    
    this.rl.close();
  }

  private async askScope(): Promise<'global' | 'project'> {
    const answer = await this.rl.question(
      'Install MCP server globally or for this project only?\n' +
      '1) Global (~/Library/Application Support/Claude/claude_desktop_config.json)\n' +
      '2) Project (.claude/settings.json)\n' +
      'Choice (1 or 2): '
    );
    
    return answer === '2' ? 'project' : 'global';
  }

  private async askYesNo(question: string): Promise<boolean> {
    const answer = await this.rl.question(`${question} (y/n): `);
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }

  private getConfigPath(scope: 'global' | 'project'): string {
    if (scope === 'global') {
      // Platform-specific paths
      if (process.platform === 'darwin') {
        return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      } else if (process.platform === 'win32') {
        return join(process.env.APPDATA || homedir(), 'Claude', 'claude_desktop_config.json');
      } else {
        // Linux fallback
        return join(homedir(), '.claude', 'claude_desktop_config.json');
      }
    } else {
      // Project scope
      return join(process.cwd(), '.claude', 'settings.json');
    }
  }

  private loadConfig(path: string): ClaudeConfig {
    if (existsSync(path)) {
      try {
        return JSON.parse(readFileSync(path, 'utf8'));
      } catch (error) {
        console.warn(`⚠️  Warning: Could not parse existing config at ${path}`);
        return {};
      }
    }
    return {};
  }

  private saveConfig(path: string, config: ClaudeConfig) {
    const dir = join(path, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, JSON.stringify(config, null, 2), 'utf8');
  }

  private async setupMCPServer(scope: 'global' | 'project') {
    const configPath = this.getConfigPath(scope);
    const config = this.loadConfig(configPath);
    
    // Determine the command based on installation type
    const isGlobalInstall = await this.checkGlobalInstall();
    const serverPath = isGlobalInstall 
      ? 'mcp-xcode-server'
      : resolve(PACKAGE_ROOT, 'dist', 'index.js');
    
    const serverConfig = {
      type: 'stdio',
      command: isGlobalInstall ? 'mcp-xcode-server' : 'node',
      args: isGlobalInstall ? [] : [serverPath],
      env: {}
    };
    
    // Add to mcpServers
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    
    if (config.mcpServers['mcp-xcode-server']) {
      const overwrite = await this.askYesNo('MCP Xcode server already configured. Overwrite?');
      if (!overwrite) {
        console.log('Skipping MCP server configuration.');
        return;
      }
    }
    
    config.mcpServers['mcp-xcode-server'] = serverConfig;
    
    this.saveConfig(configPath, config);
    console.log(`✅ MCP server configured in ${configPath}`);
  }

  private async setupHooks(scope: 'global' | 'project') {
    const configPath = this.getConfigPath(scope);
    const config = this.loadConfig(configPath);
    
    const hookScriptPath = resolve(PACKAGE_ROOT, 'scripts', 'auto-add-to-xcode.swift');
    
    // Ensure script is executable
    try {
      execSync(`chmod +x "${hookScriptPath}"`, { stdio: 'ignore' });
    } catch (error) {
      // Ignore chmod errors on Windows
    }
    
    // Set up hooks
    if (!config.hooks) {
      config.hooks = {};
    }
    
    if (!config.hooks.PostToolUse) {
      config.hooks.PostToolUse = {};
    }
    
    const hookCommand = hookScriptPath;
    
    if (config.hooks.PostToolUse['Write|Edit']) {
      const overwrite = await this.askYesNo('PostToolUse hook for Write|Edit already exists. Overwrite?');
      if (!overwrite) {
        console.log('Skipping hook configuration.');
        return;
      }
    }
    
    config.hooks.PostToolUse['Write|Edit'] = hookCommand;
    
    this.saveConfig(configPath, config);
    console.log(`✅ Auto-add hook configured in ${configPath}`);
  }

  private async checkGlobalInstall(): Promise<boolean> {
    try {
      execSync('which mcp-xcode-server', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private async buildHelperTools() {
    try {
      // Build TypeScript
      console.log('  Building TypeScript...');
      execSync('npm run build', { 
        cwd: PACKAGE_ROOT,
        stdio: 'inherit' 
      });
      
      // The ModifyProjectTool will build its Swift helper on first use
      console.log('  Swift helper tools will be built on first use.');
      
    } catch (error) {
      console.error('❌ Failed to build:', error);
      process.exit(1);
    }
  }
}

// CLI Commands
program
  .name('mcp-xcode-server')
  .description('MCP Xcode Server - Setup and management')
  .version('2.4.0');

program
  .command('setup')
  .description('Interactive setup for MCP Xcode server and hooks')
  .action(async () => {
    const setup = new MCPXcodeSetup();
    await setup.setup();
  });

program
  .command('serve')
  .description('Start the MCP server')
  .action(async () => {
    // Simply run the server
    await import('./index.js');
  });

// Parse command line arguments
program.parse();

// If no command specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}