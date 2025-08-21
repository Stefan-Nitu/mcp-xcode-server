#!/usr/bin/env swift

// Xcode Sync - Automatically sync file operations to Xcode projects
// This script is meant to be used as a Claude Code PostToolUse hook

import Foundation

// MARK: - Types

enum FileAction: String {
    case add
    case remove
    case update
    case move
}

struct FileOperation {
    let action: FileAction
    let filePath: String
}

struct ProjectInfo {
    let projectPath: String
    let targetName: String
}

struct HookData {
    let toolName: String
    let toolInput: [String: Any]
    let toolResponse: [String: Any]
    let projectDir: String
}

// MARK: - Configuration

enum Configuration {
    enum FileType: String, CaseIterable {
        // Source files
        case swift, m, mm, c, cpp, cc, cxx
        // Header files
        case h, hpp, hxx
        // Resources
        case png, jpg, jpeg, gif, pdf, svg
        case json, plist, xcassets
        case storyboard, xib
        case strings, stringsdict
        // Documentation
        case md, txt, rtf, doc, docx
        // Configuration
        case xcconfig, entitlements
        // Web
        case html, css, js, ts, tsx, jsx
        // Data
        case xml, yaml, yml, toml
        // Frameworks
        case framework, a, dylib, tbd
        
        static var allExtensions: [String] {
            FileType.allCases.map { $0.rawValue }
        }
    }
    
    static var modifierPath: String {
        // Get the path to this script
        let scriptPath = CommandLine.arguments[0]
        let scriptURL = URL(fileURLWithPath: scriptPath)
        // Go up to the mcp-xcode directory
        let projectRoot = scriptURL.deletingLastPathComponent().deletingLastPathComponent()
        return projectRoot.appendingPathComponent("XcodeProjectModifier/.build/release/XcodeProjectModifier").path
    }
    static let debugLogPath = "/tmp/xcode-hook-debug.log"
    static let maxProjectSearchDepth = 10
}

// MARK: - Hook Data Parser

class HookDataParser {
    static func parse() -> HookData? {
        let stdinData = FileHandle.standardInput.readDataToEndOfFile()
        guard let json = try? JSONSerialization.jsonObject(with: stdinData) as? [String: Any] else {
            print("Error: Could not parse hook data from stdin")
            return nil
        }
        
        return HookData(
            toolName: json["tool_name"] as? String ?? "",
            toolInput: json["tool_input"] as? [String: Any] ?? [:],
            toolResponse: json["tool_response"] as? [String: Any] ?? [:],
            projectDir: json["cwd"] as? String ?? FileManager.default.currentDirectoryPath
        )
    }
}

// MARK: - File Operation Extractor

class FileOperationExtractor {
    private let hookData: HookData
    
    init(hookData: HookData) {
        self.hookData = hookData
    }
    
    func extract() -> FileOperation? {
        switch hookData.toolName {
        case "Write", "Edit", "MultiEdit":
            return extractFromFileTools()
        case "Bash":
            return extractFromBashCommand()
        default:
            return nil
        }
    }
    
    private func extractFromFileTools() -> FileOperation? {
        guard let filePath = hookData.toolInput["file_path"] as? String else { return nil }
        
        let responseType = hookData.toolResponse["type"] as? String
        
        // Only handle create operations - ignore updates
        guard responseType == "create" else {
            if responseType == "update" {
                print("Detected update operation for \(filePath) - skipping Xcode sync")
            }
            return nil
        }
        
        return FileOperation(action: .add, filePath: filePath)
    }
    
    private func extractFromBashCommand() -> FileOperation? {
        guard let command = hookData.toolInput["command"] as? String else { return nil }
        
        // Smart detection: Look for any file paths in the command and check what happened to them
        let extensionPattern = Configuration.FileType.allExtensions.joined(separator: "|")
        
        // Find all file paths with supported extensions mentioned in the command
        let filePathPatterns = [
            "([^\\s\"']+\\.(?:\(extensionPattern)))",           // Unquoted paths
            "\"([^\"]+\\.(?:\(extensionPattern)))\"",          // Double-quoted paths
            "'([^']+\\.(?:\(extensionPattern)))'"              // Single-quoted paths
        ]
        
        var detectedFiles: [(path: String, exists: Bool)] = []
        
        for pattern in filePathPatterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: []) {
                let matches = regex.matches(in: command, options: [], range: NSRange(command.startIndex..., in: command))
                for match in matches {
                    if let range = Range(match.range(at: 1), in: command) {
                        let filePath = String(command[range])
                        let absolutePath = makeAbsolute(filePath)
                        let exists = FileManager.default.fileExists(atPath: absolutePath)
                        detectedFiles.append((path: absolutePath, exists: exists))
                    }
                }
            }
        }
        
        // Now determine what happened based on file existence and command context
        for (filePath, exists) in detectedFiles {
            // File exists - likely created or modified
            if exists {
                // Check if command suggests creation (not just reading/checking)
                let creationKeywords = ["touch", ">", ">>", "create", "new", "add", "generate", "echo", "cat", "cp", "install"]
                for keyword in creationKeywords {
                    if command.contains(keyword) {
                        return FileOperation(action: .add, filePath: filePath)
                    }
                }
            } else {
                // File doesn't exist - might have been removed
                let removalKeywords = ["rm", "remove", "delete", "unlink", "clean"]
                for keyword in removalKeywords {
                    if command.contains(keyword) {
                        return FileOperation(action: .remove, filePath: filePath)
                    }
                }
            }
        }
        
        // Check for move operations (two files mentioned, one exists, one doesn't)
        if detectedFiles.count == 2 {
            let first = detectedFiles[0]
            let second = detectedFiles[1]
            if !first.exists && second.exists && command.contains("mv") {
                return FileOperation(action: .move, filePath: second.path)
            }
        }
        
        return nil
    }
    
    private func extractRemoveOperation(from command: String) -> FileOperation? {
        guard command.contains("rm ") || command.contains("rm -f") || command.contains("rm -rf") else {
            return nil
        }
        
        let patterns = createRegexPatterns(for: "rm\\s+(-[rf]+\\s+)?")
        
        for pattern in patterns {
            if let filePath = matchPattern(pattern, in: command, captureGroup: -1) {
                let absolutePath = makeAbsolute(filePath)
                return FileOperation(action: .remove, filePath: absolutePath)
            }
        }
        
        return nil
    }
    
    private func extractMoveOperation(from command: String) -> FileOperation? {
        guard command.contains("mv ") else { return nil }
        
        let extensionPattern = Configuration.FileType.allExtensions.joined(separator: "|")
        let patterns = [
            "mv\\s+([^\\s]+\\.(?:\(extensionPattern)))\\s+([^\\s]+\\.(?:\(extensionPattern)))",
            "mv\\s+\"([^\"]+\\.(?:\(extensionPattern)))\"\\s+\"([^\"]+\\.(?:\(extensionPattern)))\"",
            "mv\\s+([^\\s]+\\.(?:\(extensionPattern)))\\s+\"([^\"]+\\.(?:\(extensionPattern)))\"",
            "mv\\s+\"([^\"]+\\.(?:\(extensionPattern)))\"\\s+([^\\s]+\\.(?:\(extensionPattern)))"
        ]
        
        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: []),
                  let match = regex.firstMatch(in: command, options: [], range: NSRange(command.startIndex..., in: command)) else {
                continue
            }
            
            if let destRange = Range(match.range(at: 2), in: command) {
                let destPath = String(command[destRange])
                let absoluteDest = makeAbsolute(destPath)
                return FileOperation(action: .move, filePath: absoluteDest)
            }
        }
        
        return nil
    }
    
    private func extractCreateOperation(from command: String) -> FileOperation? {
        let extensionPattern = Configuration.FileType.allExtensions.joined(separator: "|")
        
        // Look for any file path with our supported extensions in the command
        // This catches touch, echo >, custom commands, aliases, etc.
        let patterns = [
            // Standard touch command
            "touch\\s+([^\\s]+\\.(?:\(extensionPattern)))",
            "touch\\s+\"([^\"]+\\.(?:\(extensionPattern)))\"",
            "touch\\s+'([^']+\\.(?:\(extensionPattern)))'",
            
            // Output redirection
            ">\\s*([^\\s]+\\.(?:\(extensionPattern)))",
            ">\\s*\"([^\"]+\\.(?:\(extensionPattern)))\"",
            ">\\s*'([^']+\\.(?:\(extensionPattern)))'",
            
            // Any file path in the command (catches custom commands/aliases)
            "\\s([^\\s]+\\.(?:\(extensionPattern)))(?:\\s|$)",
            "\"([^\"]+\\.(?:\(extensionPattern)))\"",
            "'([^']+\\.(?:\(extensionPattern)))'"
        ]
        
        for pattern in patterns {
            if let filePath = matchPattern(pattern, in: command, captureGroup: 1) {
                let absolutePath = makeAbsolute(filePath)
                // Only return if this looks like a file creation (not just mentioning a file)
                // Check for creation indicators or if file is new
                if command.contains("touch") || command.contains(">") || 
                   command.contains("create") || command.contains("new") ||
                   command.contains("add") || command.contains("generate") {
                    return FileOperation(action: .add, filePath: absolutePath)
                }
            }
        }
        
        return nil
    }
    
    private func createRegexPatterns(for prefix: String) -> [String] {
        let extensionPattern = Configuration.FileType.allExtensions.joined(separator: "|")
        return [
            "\(prefix)([^\\s]+\\.(?:\(extensionPattern)))",
            "\(prefix)\"([^\"]+\\.(?:\(extensionPattern)))\""
        ]
    }
    
    private func matchPattern(_ pattern: String, in text: String, captureGroup: Int) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []),
              let match = regex.firstMatch(in: text, options: [], range: NSRange(text.startIndex..., in: text)) else {
            return nil
        }
        
        let groupIndex = captureGroup < 0 ? match.numberOfRanges - 1 : captureGroup
        guard let range = Range(match.range(at: groupIndex), in: text) else { return nil }
        
        return String(text[range])
    }
    
    private func makeAbsolute(_ path: String) -> String {
        path.hasPrefix("/") ? path : "\(hookData.projectDir)/\(path)"
    }
}

// MARK: - Project Finder

class ProjectFinder {
    static func findNearestProject(from filePath: String) -> ProjectInfo? {
        var currentDir = URL(fileURLWithPath: filePath).deletingLastPathComponent()
        let fileManager = FileManager.default
        
        for _ in 0..<Configuration.maxProjectSearchDepth {
            do {
                let contents = try fileManager.contentsOfDirectory(at: currentDir, includingPropertiesForKeys: nil)
                
                for item in contents {
                    if item.pathExtension == "xcodeproj" {
                        let pbxprojPath = item.appendingPathComponent("project.pbxproj").path
                        
                        if fileManager.fileExists(atPath: pbxprojPath) {
                            let targetName = item.deletingPathExtension().lastPathComponent
                            return ProjectInfo(projectPath: item.path, targetName: targetName)
                        }
                    }
                }
                
                let parent = currentDir.deletingLastPathComponent()
                if parent.path == currentDir.path { break }
                currentDir = parent
                
            } catch {
                break
            }
        }
        
        return nil
    }
}

// MARK: - Group Path Calculator

class GroupPathCalculator {
    static func calculate(filePath: String, projectDir: String, targetName: String) -> String {
        let fileURL = URL(fileURLWithPath: filePath)
        let projectURL = URL(fileURLWithPath: projectDir)
        
        var fileComponents = fileURL.deletingLastPathComponent().pathComponents
        let projectComponents = projectURL.pathComponents
        
        // Remove common prefix
        for component in projectComponents {
            if !fileComponents.isEmpty && fileComponents[0] == component {
                fileComponents.removeFirst()
            }
        }
        
        // If file is in target directory
        if !fileComponents.isEmpty && fileComponents[0] == targetName {
            return fileComponents.joined(separator: "/")
        }
        
        // Otherwise, place in target root
        if fileComponents.isEmpty {
            return targetName
        }
        
        return "\(targetName)/\(fileComponents.joined(separator: "/"))"
    }
}

// MARK: - Project Settings Manager

class ProjectSettingsManager {
    static func isAutoSyncDisabled(projectDir: String) -> Bool {
        let fileManager = FileManager.default
        
        // Check for .no-xcode-autoadd file (keeping old name for compatibility)
        let optOutFile = URL(fileURLWithPath: projectDir).appendingPathComponent(".no-xcode-autoadd").path
        if fileManager.fileExists(atPath: optOutFile) {
            return true
        }
        
        // Check for .no-xcode-sync file (new name)
        let newOptOutFile = URL(fileURLWithPath: projectDir).appendingPathComponent(".no-xcode-sync").path
        if fileManager.fileExists(atPath: newOptOutFile) {
            return true
        }
        
        // Check for .claude/settings.json
        let claudeSettings = URL(fileURLWithPath: projectDir)
            .appendingPathComponent(".claude")
            .appendingPathComponent("settings.json").path
        
        if fileManager.fileExists(atPath: claudeSettings) {
            if let data = fileManager.contents(atPath: claudeSettings),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                // Check both old and new setting names
                if let xcodeAutoadd = json["xcodeAutoadd"] as? Bool, !xcodeAutoadd {
                    return true
                }
                if let xcodeSync = json["xcodeSync"] as? Bool, !xcodeSync {
                    return true
                }
            }
        }
        
        return false
    }
}

// MARK: - Xcode Project Modifier

class XcodeProjectModifier {
    private let projectInfo: ProjectInfo
    
    init(projectInfo: ProjectInfo) {
        self.projectInfo = projectInfo
    }
    
    func execute(operation: FileOperation, groupPath: String) throws {
        // Map FileAction to modifier command
        let modifierAction: String = {
            switch operation.action {
            case .add, .update, .move:
                return "add"  // All these operations use "add" which replaces existing references
            case .remove:
                return "remove"
            }
        }()
        
        let process = Process()
        process.executableURL = URL(fileURLWithPath: Configuration.modifierPath)
        process.arguments = [
            projectInfo.projectPath,
            modifierAction,
            operation.filePath,
            projectInfo.targetName,
            "--group-path", groupPath
        ]
        
        try process.run()
        process.waitUntilExit()
        
        if process.terminationStatus == 0 {
            printSuccessMessage(for: operation.action, filePath: operation.filePath)
        } else {
            let actionDescription = describeAction(operation.action)
            print("Failed to \(actionDescription) file in project (exit code: \(process.terminationStatus))")
        }
    }
    
    private func describeAction(_ action: FileAction) -> String {
        switch action {
        case .add: return "add"
        case .remove: return "remove"
        case .update: return "update"
        case .move: return "move/rename"
        }
    }
    
    private func printSuccessMessage(for action: FileAction, filePath: String) {
        switch action {
        case .add:
            print("✅ Successfully added \(filePath) to Xcode project")
        case .remove:
            print("✅ Successfully removed \(filePath) from Xcode project")
        case .update:
            print("✅ Successfully updated \(filePath) in Xcode project")
        case .move:
            print("✅ Successfully moved/renamed file in Xcode project")
        }
    }
}

// MARK: - Debug Logger

class DebugLogger {
    static func log(_ hookData: HookData) {
        let debugLog = """
        === Hook Debug Log ===
        Date: \(Date())
        Tool Name: \(hookData.toolName)
        Tool Input: \(hookData.toolInput)
        Tool Response: \(hookData.toolResponse)
        Project Dir: \(hookData.projectDir)
        =====================
        """
        
        try? debugLog.write(toFile: Configuration.debugLogPath, atomically: true, encoding: .utf8)
    }
}

// MARK: - Helper Functions

func isPartOfSwiftPackage(filePath: String) -> Bool {
    var currentDir = URL(fileURLWithPath: filePath).deletingLastPathComponent()
    let fileManager = FileManager.default
    
    // Check up to 10 directories up
    for _ in 0..<10 {
        let packageSwiftPath = currentDir.appendingPathComponent("Package.swift").path
        if fileManager.fileExists(atPath: packageSwiftPath) {
            return true
        }
        
        // Stop at root
        let parent = currentDir.deletingLastPathComponent()
        if parent.path == currentDir.path {
            break
        }
        currentDir = parent
    }
    
    return false
}

func isInFolderReference(filePath: String, projectPath: String) -> Bool {
    // Check if the file is in a folder that's added as a folder reference (blue folder in Xcode)
    // These folders are synced automatically by Xcode
    
    // Read the pbxproj file to check for folder references
    let pbxprojPath = "\(projectPath)/project.pbxproj"
    guard let pbxprojContent = try? String(contentsOfFile: pbxprojPath, encoding: .utf8) else {
        return false
    }
    
    // Check if any parent directory of the file is a folder reference
    let fileURL = URL(fileURLWithPath: filePath)
    var currentDir = fileURL.deletingLastPathComponent()
    let projectURL = URL(fileURLWithPath: projectPath).deletingLastPathComponent()
    
    while currentDir.path != projectURL.path && currentDir.path != "/" {
        let dirName = currentDir.lastPathComponent
        
        // Check if this specific directory is a folder reference
        // Look for pattern: path = "dirName"; ... lastKnownFileType = folder
        // This ensures we're matching the actual folder reference, not just any folder name
        let pattern = "path = \"\(dirName)\".*?lastKnownFileType = folder"
        if let regex = try? NSRegularExpression(pattern: pattern, options: [.dotMatchesLineSeparators]),
           regex.firstMatch(in: pbxprojContent, options: [], range: NSRange(pbxprojContent.startIndex..., in: pbxprojContent)) != nil {
            return true
        }
        
        currentDir = currentDir.deletingLastPathComponent()
    }
    
    return false
}

func isFileAlreadyInProject(filePath: String, projectPath: String) -> Bool {
    // Check if the file is already referenced in the project
    let pbxprojPath = "\(projectPath)/project.pbxproj"
    guard let pbxprojContent = try? String(contentsOfFile: pbxprojPath, encoding: .utf8) else {
        return false
    }
    
    let fileName = URL(fileURLWithPath: filePath).lastPathComponent
    
    // Check if file is already in the project
    // Look for the file name in PBXFileReference section
    return pbxprojContent.contains("/* \(fileName) */") || 
           pbxprojContent.contains("\"\(fileName)\"")
}

// MARK: - Main Application

class XcodeSyncApp {
    static func run() {
        // Parse hook data
        guard let hookData = HookDataParser.parse() else {
            exit(1)
        }
        
        // Debug logging
        DebugLogger.log(hookData)
        
        // Extract file operation
        let extractor = FileOperationExtractor(hookData: hookData)
        guard let operation = extractor.extract() else {
            exit(0) // No relevant operation detected
        }
        
        // Check if file has supported extension
        let fileURL = URL(fileURLWithPath: operation.filePath)
        let fileExtension = fileURL.pathExtension.lowercased()
        guard Configuration.FileType(rawValue: fileExtension) != nil else {
            exit(0) // Unsupported file type
        }
        
        print("Detected \(operation.action.rawValue) operation for \(operation.filePath)")
        
        // Check if file is part of a Swift Package
        if isPartOfSwiftPackage(filePath: operation.filePath) {
            print("File is part of a Swift Package - skipping Xcode project sync")
            exit(0)
        }
        
        // Find nearest Xcode project
        guard let projectInfo = ProjectFinder.findNearestProject(from: operation.filePath) else {
            print("No Xcode project found")
            exit(0)
        }
        
        let projectDir = URL(fileURLWithPath: projectInfo.projectPath).deletingLastPathComponent().path
        let groupPath = GroupPathCalculator.calculate(
            filePath: operation.filePath,
            projectDir: projectDir,
            targetName: projectInfo.targetName
        )
        
        // Check if auto-sync is disabled
        if ProjectSettingsManager.isAutoSyncDisabled(projectDir: projectDir) {
            print("Xcode sync is disabled for this project")
            exit(0)
        }
        
        // Check if file is in a folder reference (Xcode auto-syncs these)
        if isInFolderReference(filePath: operation.filePath, projectPath: projectInfo.projectPath) {
            print("File is in a folder reference - Xcode will sync automatically")
            exit(0)
        }
        
        // For add operations, check if file is already in project
        if operation.action == .add && isFileAlreadyInProject(filePath: operation.filePath, projectPath: projectInfo.projectPath) {
            print("File is already in the project - skipping")
            exit(0)
        }
        
        print("Found project: \(projectInfo.projectPath)")
        print("Target: \(projectInfo.targetName)")
        print("Group path: \(groupPath)")
        
        // Check if XcodeProjectModifier is available
        guard FileManager.default.fileExists(atPath: Configuration.modifierPath) else {
            print("XcodeProjectModifier not found. Make sure the MCP server has been used at least once.")
            exit(0)
        }
        
        // Execute the modification
        let modifier = XcodeProjectModifier(projectInfo: projectInfo)
        do {
            try modifier.execute(operation: operation, groupPath: groupPath)
        } catch {
            print("Error running XcodeProjectModifier: \(error)")
        }
    }
}

// MARK: - Entry Point

XcodeSyncApp.run()