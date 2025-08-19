import { z } from 'zod';
import { Tool } from '../types.js';
import { execAsync } from '../utils.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { safePathSchema } from './validators.js';

const manageDependenciesSchema = z.object({
  projectPath: safePathSchema
    .describe('Path to .xcodeproj or Package.swift'),
  action: z.enum(['list', 'resolve', 'update', 'add', 'remove'])
    .describe('Action to perform'),
  packageURL: z.string().optional()
    .describe('URL of the Swift package (for add action)'),
  packageName: z.string().optional()
    .describe('Name of the package (for remove action)'),
  version: z.string().optional()
    .describe('Version requirement (e.g., "1.0.0", "from: 1.0.0", "branch: main")')
});

export interface IManageDependenciesTool extends Tool {
  execute(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }>;
}

export class ManageDependenciesTool implements IManageDependenciesTool {
  getToolDefinition() {
    return {
      name: 'manage_dependencies',
      description: 'Manage Swift Package Manager dependencies',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: { type: 'string' },
          action: { 
            type: 'string', 
            enum: ['list', 'resolve', 'update', 'add', 'remove'] 
          },
          packageURL: { type: 'string' },
          packageName: { type: 'string' },
          version: { type: 'string' }
        },
        required: ['projectPath', 'action']
      }
    };
  }

  async execute(args: unknown) {
    const parsed = manageDependenciesSchema.parse(args);
    
    try {
      switch (parsed.action) {
        case 'list': {
          // For Package.swift projects
          if (parsed.projectPath.endsWith('Package.swift') || existsSync(join(dirname(parsed.projectPath), 'Package.swift'))) {
            const packageDir = parsed.projectPath.endsWith('Package.swift') 
              ? dirname(parsed.projectPath) 
              : parsed.projectPath;
            
            const { stdout } = await execAsync(`swift package show-dependencies --package-path "${packageDir}"`);
            return {
              content: [{
                type: 'text',
                text: `Dependencies:\n${stdout}`
              }]
            };
          }
          
          // For Xcode projects, read Package.resolved
          const resolvedPath = join(parsed.projectPath, '..', 'project.xcworkspace', 'xcshareddata', 'swiftpm', 'Package.resolved');
          if (existsSync(resolvedPath)) {
            const resolved = JSON.parse(readFileSync(resolvedPath, 'utf-8'));
            const deps = resolved.pins?.map((pin: any) => 
              `- ${pin.identity}: ${pin.state.version || pin.state.branch || pin.state.revision}`
            ).join('\n') || 'No dependencies found';
            
            return {
              content: [{
                type: 'text',
                text: `Swift Package Dependencies:\n${deps}`
              }]
            };
          }
          
          return {
            content: [{
              type: 'text',
              text: 'No Swift Package dependencies found'
            }]
          };
        }
        
        case 'resolve': {
          if (parsed.projectPath.endsWith('.xcodeproj') || parsed.projectPath.endsWith('.xcworkspace')) {
            // Use xcodebuild to resolve dependencies
            const { stdout } = await execAsync(
              `xcodebuild -resolvePackageDependencies -project "${parsed.projectPath}" -scheme $(xcodebuild -list -json -project "${parsed.projectPath}" | grep -o '"name" : "[^"]*"' | head -1 | cut -d'"' -f4)`
            );
            return {
              content: [{
                type: 'text',
                text: 'Dependencies resolved successfully'
              }]
            };
          } else {
            // For Package.swift
            const packageDir = parsed.projectPath.endsWith('Package.swift') 
              ? dirname(parsed.projectPath) 
              : parsed.projectPath;
            const { stdout } = await execAsync(`swift package resolve --package-path "${packageDir}"`);
            return {
              content: [{
                type: 'text',
                text: 'Dependencies resolved successfully'
              }]
            };
          }
        }
        
        case 'update': {
          if (parsed.projectPath.endsWith('Package.swift') || existsSync(join(dirname(parsed.projectPath), 'Package.swift'))) {
            const packageDir = parsed.projectPath.endsWith('Package.swift') 
              ? dirname(parsed.projectPath) 
              : parsed.projectPath;
            const { stdout } = await execAsync(`swift package update --package-path "${packageDir}"`);
            return {
              content: [{
                type: 'text',
                text: `Dependencies updated:\n${stdout}`
              }]
            };
          }
          
          return {
            content: [{
              type: 'text',
              text: 'Update is only supported for Package.swift projects. For Xcode projects, use Xcode to update dependencies.'
            }]
          };
        }
        
        case 'add': {
          if (!parsed.packageURL) {
            throw new Error('packageURL is required for add action');
          }
          
          // For Package.swift, we need to modify the file
          if (parsed.projectPath.endsWith('Package.swift')) {
            const content = readFileSync(parsed.projectPath, 'utf-8');
            
            // Parse package name from URL
            const packageName = parsed.packageName || parsed.packageURL.split('/').pop()?.replace('.git', '') || 'Package';
            
            // Create dependency string
            const versionStr = parsed.version || 'from: "1.0.0"';
            const depString = `.package(url: "${parsed.packageURL}", ${versionStr})`;
            
            // Insert into dependencies array
            const modifiedContent = content.replace(
              /(dependencies:\s*\[)/,
              `$1\n        ${depString},`
            );
            
            writeFileSync(parsed.projectPath, modifiedContent);
            
            return {
              content: [{
                type: 'text',
                text: `Added ${packageName} to Package.swift. Run 'swift package resolve' to fetch the dependency.`
              }]
            };
          }
          
          return {
            content: [{
              type: 'text',
              text: 'Adding dependencies to Xcode projects requires using Xcode GUI or modifying the project file directly.'
            }]
          };
        }
        
        case 'remove': {
          if (!parsed.packageName) {
            throw new Error('packageName is required for remove action');
          }
          
          if (parsed.projectPath.endsWith('Package.swift')) {
            const content = readFileSync(parsed.projectPath, 'utf-8');
            
            // Remove package line containing the package name
            const lines = content.split('\n');
            const filteredLines = lines.filter(line => 
              !line.includes(`.package`) || !line.includes(parsed.packageName!)
            );
            
            writeFileSync(parsed.projectPath, filteredLines.join('\n'));
            
            return {
              content: [{
                type: 'text',
                text: `Removed ${parsed.packageName} from Package.swift`
              }]
            };
          }
          
          return {
            content: [{
              type: 'text',
              text: 'Removing dependencies from Xcode projects requires using Xcode GUI or modifying the project file directly.'
            }]
          };
        }
        
        default:
          return {
            content: [{
              type: 'text',
              text: `Unknown action: ${parsed.action}`
            }]
          };
      }
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error managing dependencies: ${error.message}`
        }]
      };
    }
  }
}