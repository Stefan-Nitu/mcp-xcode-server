import { z } from 'zod';
import { Tool } from '../types.js';
import { execAsync } from '../utils.js';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname, basename } from 'path';
import { safePathSchema } from './validators.js';
import { SimulatorManager } from '../simulatorManager.js';

const swiftUIPreviewSchema = z.object({
  swiftFilePath: safePathSchema
    .describe('Path to the SwiftUI view file'),
  previewName: z.string().optional()
    .describe('Name of the preview to render (if multiple)'),
  colorScheme: z.enum(['light', 'dark']).optional()
    .describe('Color scheme for preview')
});

export interface ISwiftUIPreviewTool extends Tool {
  execute(args: unknown): Promise<{ content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> }>;
}

export class SwiftUIPreviewTool implements ISwiftUIPreviewTool {
  private simulatorManager = SimulatorManager;
  
  getToolDefinition() {
    return {
      name: 'swiftui_preview',
      description: 'Generate a preview of a SwiftUI view by rendering it in a simulator',
      inputSchema: {
        type: 'object',
        properties: {
          swiftFilePath: { type: 'string' },
          previewName: { type: 'string' },
          colorScheme: { type: 'string', enum: ['light', 'dark'] }
        },
        required: ['swiftFilePath']
      }
    };
  }

  private async createPreviewApp(swiftFilePath: string, previewName?: string, colorScheme?: string): Promise<string> {
    const tempDir = `/tmp/SwiftUIPreview_${Date.now()}`;
    const appName = 'PreviewApp';
    
    // Create temp directory structure
    mkdirSync(tempDir, { recursive: true });
    mkdirSync(`${tempDir}/${appName}`, { recursive: true });
    
    // Create Package.swift for the preview app
    const packageSwift = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "${appName}",
    platforms: [.iOS(.v17)],
    products: [
        .executable(name: "${appName}", targets: ["${appName}"])
    ],
    targets: [
        .executableTarget(
            name: "${appName}",
            path: ".")
    ]
)`;
    
    // Read the original SwiftUI view file
    const viewContent = await execAsync(`cat "${swiftFilePath}"`);
    
    // Extract the view struct name
    const viewNameMatch = viewContent.stdout.match(/struct\s+(\w+)\s*:\s*View/);
    const viewName = viewNameMatch ? viewNameMatch[1] : 'ContentView';
    
    // Create the preview app that hosts the SwiftUI view
    const appMain = `import SwiftUI

// Include the original view
${viewContent.stdout}

// Preview host app
@main
struct PreviewApp: App {
    var body: some Scene {
        WindowGroup {
            ${viewName}()
                ${colorScheme === 'dark' ? '.preferredColorScheme(.dark)' : ''}
                .onAppear {
                    // Give the view time to render
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        // Signal that preview is ready (for automation)
                        print("PREVIEW_READY")
                    }
                }
        }
    }
}`;
    
    // Write the files
    writeFileSync(`${tempDir}/Package.swift`, packageSwift);
    writeFileSync(`${tempDir}/${appName}/main.swift`, appMain);
    
    // Build the app for generic iOS simulator
    await execAsync(
      `cd ${tempDir} && xcodebuild -scheme ${appName} -destination 'generic/platform=iOS Simulator' build`,
      { maxBuffer: 10 * 1024 * 1024 }
    );
    
    // Find the built app
    const { stdout } = await execAsync(
      `find ${tempDir} -name "${appName}.app" -type d | head -1`
    );
    
    return stdout.trim();
  }

  async execute(args: unknown) {
    const parsed = swiftUIPreviewSchema.parse(args);
    
    try {
      // Verify the Swift file exists
      if (!existsSync(parsed.swiftFilePath)) {
        throw new Error(`SwiftUI file not found: ${parsed.swiftFilePath}`);
      }
      
      // Get or boot a simulator using the same logic as build/test tools
      const { Platform } = await import('../types.js');
      const targetDevice = await this.simulatorManager.ensureSimulatorBooted(Platform.iOS);
      
      // Create and build the preview app
      const appPath = await this.createPreviewApp(
        parsed.swiftFilePath,
        parsed.previewName,
        parsed.colorScheme
      );
      
      if (!appPath) {
        throw new Error('Failed to build preview app');
      }
      
      // Install the app
      await execAsync(`xcrun simctl install "${targetDevice}" "${appPath}"`);
      
      // Get the app bundle ID
      const { stdout: bundleId } = await execAsync(
        `plutil -extract CFBundleIdentifier raw "${appPath}/Info.plist"`
      );
      
      // Launch the app
      await execAsync(`xcrun simctl launch "${targetDevice}" ${bundleId.trim()}`);
      
      // Wait for the view to render
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Take a screenshot
      const screenshotPath = `/tmp/preview_${Date.now()}.png`;
      await execAsync(`xcrun simctl io "${targetDevice}" screenshot "${screenshotPath}"`);
      
      // Read the screenshot as base64
      const { stdout: imageData } = await execAsync(`base64 -i "${screenshotPath}"`);
      
      // Clean up
      await execAsync(`xcrun simctl uninstall "${targetDevice}" ${bundleId.trim()}`).catch(() => {});
      rmSync(dirname(appPath), { recursive: true, force: true });
      rmSync(screenshotPath, { force: true });
      
      return {
        content: [
          {
            type: 'text',
            text: `SwiftUI preview rendered for ${basename(parsed.swiftFilePath)}`
          },
          {
            type: 'image',
            data: imageData.trim(),
            mimeType: 'image/png'
          }
        ]
      };
      
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error generating SwiftUI preview: ${error.message}`
        }]
      };
    }
  }
}