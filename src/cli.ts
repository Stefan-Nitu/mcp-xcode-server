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
      console.log('\n📝 Xcode Sync Hook Information:');
      console.log('The global hook will automatically sync file operations with Xcode projects.');
      console.log('It syncs when:');
      console.log('  - Files are created, modified, deleted, or moved');
      console.log('  - An .xcodeproj file exists in the parent directories');
      console.log('  - The project hasn\'t opted out (via .no-xcode-sync or .no-xcode-autoadd file)');
    }
    
    const setupHooks = await this.askYesNo('Would you like to enable Xcode file sync? (recommended)');
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
    
    const hookScriptPath = resolve(PACKAGE_ROOT, 'scripts', 'xcode-sync.swift');
    
    // Ensure script is executable
    try {
      execSync(`chmod +x "${hookScriptPath}"`, { stdio: 'ignore' });
    } catch (error) {
      // Ignore chmod errors on Windows
    }
    
    // Set up hooks using the correct Claude settings format
    if (!config.hooks) {
      config.hooks = {};
    }
    
    if (!config.hooks.PostToolUse) {
      config.hooks.PostToolUse = [];
    }
    
    // Check if hook already exists
    const existingHookIndex = config.hooks.PostToolUse.findIndex((hook: any) => 
      hook.matcher === 'Write|Edit|MultiEdit|Bash' && 
      hook.hooks?.[0]?.command?.includes('xcode-sync.swift')
    );
    
    if (existingHookIndex >= 0) {
      const overwrite = await this.askYesNo('PostToolUse hook for Xcode sync already exists. Overwrite?');
      if (!overwrite) {
        console.log('Skipping hook configuration.');
        return;
      }
      // Remove existing hook
      config.hooks.PostToolUse.splice(existingHookIndex, 1);
    }
    
    // Add the new hook in Claude's expected format
    config.hooks.PostToolUse.push({
      matcher: 'Write|Edit|MultiEdit|Bash',
      hooks: [{
        type: 'command',
        command: hookScriptPath
      }]
    });
    
    this.saveConfig(configPath, config);
    console.log(`✅ Xcode sync hook configured in ${configPath}`);
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
      
      // Build XcodeProjectModifier for the sync hook
      console.log('  Building XcodeProjectModifier for sync hook...');
      await this.buildXcodeProjectModifier();
      
    } catch (error) {
      console.error('❌ Failed to build:', error);
      process.exit(1);
    }
  }
  
  private async buildXcodeProjectModifier() {
    const modifierDir = '/tmp/XcodeProjectModifier';
    const modifierBinary = join(modifierDir, '.build', 'release', 'XcodeProjectModifier');
    
    // Check if already built
    if (existsSync(modifierBinary)) {
      console.log('    XcodeProjectModifier already built');
      return;
    }
    
    console.log('    Creating XcodeProjectModifier...');
    
    // Create directory structure
    mkdirSync(join(modifierDir, 'Sources', 'XcodeProjectModifier'), { recursive: true });
    
    // Create Package.swift
    const packageSwift = `// swift-tools-version: 5.9
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
)`;
    
    writeFileSync(join(modifierDir, 'Package.swift'), packageSwift);
    
    // Create main.swift (simplified version for the hook)
    const mainSwift = `import Foundation
import XcodeProj
import ArgumentParser

struct XcodeProjectModifier: ParsableCommand {
    @Argument(help: "Path to the .xcodeproj file")
    var projectPath: String
    
    @Argument(help: "Action to perform: add or remove")
    var action: String
    
    @Argument(help: "Path to the file to add/remove")
    var filePath: String
    
    @Argument(help: "Target name")
    var targetName: String
    
    @Option(name: .long, help: "Group path for the file")
    var groupPath: String = ""
    
    func run() throws {
        let project = try XcodeProj(pathString: projectPath)
        let pbxproj = project.pbxproj
        
        guard let target = pbxproj.nativeTargets.first(where: { $0.name == targetName }) else {
            print("Error: Target '\\(targetName)' not found")
            throw ExitCode.failure
        }
        
        let fileName = URL(fileURLWithPath: filePath).lastPathComponent
        
        if action == "remove" {
            // Remove file reference
            if let fileRef = pbxproj.fileReferences.first(where: { $0.path == fileName || $0.path == filePath }) {
                pbxproj.delete(object: fileRef)
                print("Removed \\(fileName) from project")
            }
        } else if action == "add" {
            // Remove existing reference if it exists
            if let existingRef = pbxproj.fileReferences.first(where: { $0.path == fileName || $0.path == filePath }) {
                pbxproj.delete(object: existingRef)
            }
            
            // Add new file reference
            let fileRef = PBXFileReference(
                sourceTree: .group,
                name: fileName,
                path: filePath
            )
            pbxproj.add(object: fileRef)
            
            // Add to appropriate build phase based on file type
            let fileExtension = URL(fileURLWithPath: filePath).pathExtension.lowercased()
            
            if ["swift", "m", "mm", "c", "cpp", "cc", "cxx"].contains(fileExtension) {
                // Add to sources build phase
                if let sourcesBuildPhase = target.buildPhases.compactMap({ $0 as? PBXSourcesBuildPhase }).first {
                    let buildFile = PBXBuildFile(file: fileRef)
                    pbxproj.add(object: buildFile)
                    sourcesBuildPhase.files?.append(buildFile)
                }
            } else if ["png", "jpg", "jpeg", "gif", "pdf", "json", "plist", "xib", "storyboard", "xcassets"].contains(fileExtension) {
                // Add to resources build phase
                if let resourcesBuildPhase = target.buildPhases.compactMap({ $0 as? PBXResourcesBuildPhase }).first {
                    let buildFile = PBXBuildFile(file: fileRef)
                    pbxproj.add(object: buildFile)
                    resourcesBuildPhase.files?.append(buildFile)
                }
            }
            
            // Add to group
            if let mainGroup = try? pbxproj.rootProject()?.mainGroup {
                mainGroup.children.append(fileRef)
            }
            
            print("Added \\(fileName) to project")
        }
        
        try project.write(path: Path(projectPath))
    }
}

XcodeProjectModifier.main()`;
    
    writeFileSync(join(modifierDir, 'Sources', 'XcodeProjectModifier', 'main.swift'), mainSwift);
    
    // Build the tool
    console.log('    Building with Swift Package Manager...');
    try {
      execSync('swift build -c release', {
        cwd: modifierDir,
        stdio: 'pipe'
      });
      console.log('    ✅ XcodeProjectModifier built successfully');
    } catch (error) {
      console.warn('    ⚠️  Warning: Could not build XcodeProjectModifier. Sync hook may not work until first MCP server use.');
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