import { z } from 'zod';
import { Tool } from '../types.js';
import { execAsync } from '../utils.js';
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { safePathSchema } from './validators.js';

const modifyProjectSchema = z.object({
  projectPath: safePathSchema
    .describe('Path to .xcodeproj file'),
  action: z.enum(['add', 'remove'])
    .describe('Action to perform'),
  filePath: safePathSchema
    .describe('Path to the file to add/remove'),
  targetName: z.string()
    .describe('Name of the target to modify'),
  groupPath: z.string().optional()
    .describe('Group path for organizing files (e.g., "Sources/Models")')
});

export interface IModifyProjectTool extends Tool {
  execute(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }>;
}

export class ModifyProjectTool implements IModifyProjectTool {
  private helperPath = '/tmp/XcodeProjectModifier';
  
  getToolDefinition() {
    return {
      name: 'modify_project',
      description: 'Add or remove files from an Xcode project using Swift XcodeProj. Note: Xcode 16+ projects with synchronized groups require manual editing in Xcode',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: { type: 'string' },
          action: { type: 'string', enum: ['add', 'remove'] },
          filePath: { type: 'string' },
          targetName: { type: 'string' },
          groupPath: { type: 'string' }
        },
        required: ['projectPath', 'action', 'filePath', 'targetName']
      }
    };
  }

  private async ensureHelperTool(): Promise<void> {
    // Check if the helper tool already exists and is recent
    if (existsSync(`${this.helperPath}/.build/release/XcodeProjectModifier`)) {
      return;
    }

    // Create Swift Package for the helper tool
    const packageSwift = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "XcodeProjectModifier",
    platforms: [.macOS(.v12)],
    dependencies: [
        .package(url: "https://github.com/tuist/XcodeProj.git", from: "9.5.0"),
        .package(url: "https://github.com/apple/swift-argument-parser", from: "1.0.0")
    ],
    targets: [
        .executableTarget(
            name: "XcodeProjectModifier",
            dependencies: [
                "XcodeProj",
                .product(name: "ArgumentParser", package: "swift-argument-parser")
            ]),
    ]
)`;

    const mainSwift = `import Foundation
import XcodeProj
import PathKit
import ArgumentParser

@main
struct XcodeProjectModifier: ParsableCommand {
    @Argument(help: "Path to the .xcodeproj file")
    var projectPath: String
    
    @Argument(help: "Action to perform (add or remove)")
    var action: String
    
    @Argument(help: "Path to the file to add/remove")
    var filePath: String
    
    @Argument(help: "Name of the target")
    var targetName: String
    
    @Option(help: "Group path for organizing files")
    var groupPath: String = "Sources"
    
    mutating func run() throws {
        let projectPath = Path(self.projectPath)
        let xcodeproj = try XcodeProj(path: projectPath)
        let pbxproj = xcodeproj.pbxproj
        
        // Find the target
        guard let target = pbxproj.nativeTargets.first(where: { $0.name == targetName }) else {
            print("Error: Target '\\(targetName)' not found")
            throw ExitCode.failure
        }
        
        // Check if this project uses synchronized groups (Xcode 16+)
        let hasSynchronizedGroups = pbxproj.rootObject?.fileSystemSynchronizedGroups?.isEmpty == false
        
        if hasSynchronizedGroups {
            // Handle synchronized groups
            print("Project uses synchronized groups (Xcode 16+)")
            
            // Find the synchronized root group containing this file
            guard let synchronizedGroup = pbxproj.rootObject?.fileSystemSynchronizedGroups?.first(where: { group in
                // Check if the file path is within this synchronized group
                if let groupPath = group.path {
                    return filePath.contains(groupPath) || Path(filePath).lastComponent == Path(filePath).lastComponent
                }
                return true
            }) else {
                print("Error: No synchronized group found for file")
                throw ExitCode.failure
            }
            
            // Get the relative path from the synchronized group root
            let relativePath = Path(filePath).lastComponent
            
            if action == "remove" {
                // Find or create the exception set for this target and synchronized group
                var exceptionSet: PBXFileSystemSynchronizedBuildFileExceptionSet?
                
                // Look for existing exception set
                if let exceptions = synchronizedGroup.exceptions {
                    exceptionSet = exceptions.compactMap { $0 as? PBXFileSystemSynchronizedBuildFileExceptionSet }
                        .first { $0.target == target }
                }
                
                if exceptionSet == nil {
                    // Create new exception set
                    exceptionSet = PBXFileSystemSynchronizedBuildFileExceptionSet(
                        target: target,
                        membershipExceptions: [relativePath],
                        publicHeaders: nil,
                        privateHeaders: nil,
                        additionalCompilerFlagsByRelativePath: nil,
                        attributesByRelativePath: nil
                    )
                    pbxproj.add(object: exceptionSet!)
                    
                    // Add to synchronized group's exceptions
                    if synchronizedGroup.exceptions == nil {
                        synchronizedGroup.exceptions = []
                    }
                    synchronizedGroup.exceptions?.append(exceptionSet!)
                } else {
                    // Add to existing exception set
                    if exceptionSet?.membershipExceptions == nil {
                        exceptionSet?.membershipExceptions = []
                    }
                    if !(exceptionSet?.membershipExceptions?.contains(relativePath) ?? false) {
                        exceptionSet?.membershipExceptions?.append(relativePath)
                    }
                }
                
                print("Successfully excluded '\\(filePath)' from target '\\(targetName)'")
                
            } else if action == "add" {
                // Remove from exception set if it exists
                if let exceptions = synchronizedGroup.exceptions {
                    for exception in exceptions {
                        if let buildException = exception as? PBXFileSystemSynchronizedBuildFileExceptionSet,
                           buildException.target == target {
                            buildException.membershipExceptions?.removeAll { $0 == relativePath }
                            
                            // If no more exceptions, remove the exception set
                            if buildException.membershipExceptions?.isEmpty ?? true {
                                synchronizedGroup.exceptions?.removeAll { $0 === buildException }
                                pbxproj.delete(object: buildException)
                            }
                        }
                    }
                }
                
                print("Successfully included '\\(filePath)' in target '\\(targetName)'")
            }
            
        } else {
            // Original implementation for non-synchronized projects
            if action == "add" {
                // Check if file exists
                guard FileManager.default.fileExists(atPath: filePath) else {
                    print("Error: File '\\(filePath)' does not exist")
                    throw ExitCode.failure
                }
                
                // Navigate to or create the group
                var currentGroup = pbxproj.rootObject?.mainGroup
                for groupName in groupPath.split(separator: "/") {
                    let name = String(groupName)
                    if let existingGroup = currentGroup?.children.compactMap({ $0 as? PBXGroup }).first(where: { $0.name == name || $0.path == name }) {
                        currentGroup = existingGroup
                    } else {
                        let newGroup = PBXGroup(children: [], sourceTree: .group, name: name)
                        pbxproj.add(object: newGroup)
                        currentGroup?.children.append(newGroup)
                        currentGroup = newGroup
                    }
                }
                
                // Create file reference
                let fileRef = try PBXFileReference(
                    sourceTree: .group,
                    name: Path(filePath).lastComponent,
                    path: filePath
                )
                pbxproj.add(object: fileRef)
                currentGroup?.children.append(fileRef)
                
                // Add to appropriate build phase
                let fileExtension = Path(filePath).extension ?? ""
                
                if ["swift", "m", "mm", "c", "cpp", "cc"].contains(fileExtension) {
                    // Add to sources build phase
                    if let sourcesBuildPhase = target.buildPhases.compactMap({ $0 as? PBXSourcesBuildPhase }).first {
                        let buildFile = PBXBuildFile(file: fileRef)
                        pbxproj.add(object: buildFile)
                        sourcesBuildPhase.files?.append(buildFile)
                    }
                } else if ["png", "jpg", "jpeg", "json", "plist", "xcassets", "storyboard", "xib"].contains(fileExtension) {
                    // Add to resources build phase
                    if let resourcesBuildPhase = target.buildPhases.compactMap({ $0 as? PBXResourcesBuildPhase }).first {
                        let buildFile = PBXBuildFile(file: fileRef)
                        pbxproj.add(object: buildFile)
                        resourcesBuildPhase.files?.append(buildFile)
                    }
                } else if ["framework", "a", "dylib", "tbd"].contains(fileExtension) {
                    // Add to frameworks build phase
                    if let frameworksBuildPhase = target.buildPhases.compactMap({ $0 as? PBXFrameworksBuildPhase }).first {
                        let buildFile = PBXBuildFile(file: fileRef)
                        pbxproj.add(object: buildFile)
                        frameworksBuildPhase.files?.append(buildFile)
                    }
                }
                
                print("Successfully added '\\(filePath)' to target '\\(targetName)'")
                
            } else if action == "remove" {
                // Find file references matching the path
                let fileRefs = pbxproj.fileReferences.filter { 
                    $0.path == filePath || $0.name == Path(filePath).lastComponent
                }
                
                if fileRefs.isEmpty {
                    print("Warning: File '\\(filePath)' not found in project")
                } else {
                    for fileRef in fileRefs {
                        // Remove from all build phases
                        for buildPhase in target.buildPhases {
                            if let sourcePhase = buildPhase as? PBXSourcesBuildPhase {
                                sourcePhase.files?.removeAll { $0.file == fileRef }
                            } else if let resourcePhase = buildPhase as? PBXResourcesBuildPhase {
                                resourcePhase.files?.removeAll { $0.file == fileRef }
                            } else if let frameworkPhase = buildPhase as? PBXFrameworksBuildPhase {
                                frameworkPhase.files?.removeAll { $0.file == fileRef }
                            }
                        }
                        
                        // Remove from groups
                        func removeFromGroup(_ group: PBXGroup) {
                            group.children.removeAll { $0 == fileRef }
                            for child in group.children {
                                if let childGroup = child as? PBXGroup {
                                    removeFromGroup(childGroup)
                                }
                            }
                        }
                        
                        if let mainGroup = pbxproj.rootObject?.mainGroup {
                            removeFromGroup(mainGroup)
                        }
                        
                        // Remove the file reference itself
                        pbxproj.delete(object: fileRef)
                    }
                    print("Successfully removed '\\(filePath)' from target '\\(targetName)'")
                }
            }
        }
        
        if action != "add" && action != "remove" {
            print("Error: Unknown action '\\(action)'")
            throw ExitCode.failure
        }
        
        // Save the project
        try xcodeproj.write(path: projectPath)
    }
}`;

    // Create the helper tool directory
    mkdirSync(this.helperPath, { recursive: true });
    mkdirSync(`${this.helperPath}/Sources/XcodeProjectModifier`, { recursive: true });
    
    // Write the files
    writeFileSync(`${this.helperPath}/Package.swift`, packageSwift);
    writeFileSync(`${this.helperPath}/Sources/XcodeProjectModifier/main.swift`, mainSwift);
    
    // Build the helper tool
    await execAsync(`cd ${this.helperPath} && swift build -c release`);
  }

  async execute(args: unknown) {
    const parsed = modifyProjectSchema.parse(args);
    
    try {
      // Ensure the helper tool is built
      await this.ensureHelperTool();
      
      // Execute the helper tool
      const { stdout, stderr } = await execAsync(
        `${this.helperPath}/.build/release/XcodeProjectModifier "${parsed.projectPath}" "${parsed.action}" "${parsed.filePath}" "${parsed.targetName}" --group-path "${parsed.groupPath || 'Sources'}"`
      );
      
      return {
        content: [{
          type: 'text',
          text: stdout || 'Project modified successfully'
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error modifying project: ${error.message}\n${error.stderr || ''}`
        }]
      };
    }
  }
}