#!/usr/bin/env swift

// Auto-add Swift files to Xcode projects
// This script is meant to be used as a Claude Code PostToolUse hook

import Foundation

// Get environment variables from Claude Code
let toolName = ProcessInfo.processInfo.environment["CLAUDE_TOOL_NAME"] ?? ""
let toolOutput = ProcessInfo.processInfo.environment["CLAUDE_TOOL_OUTPUT"] ?? ""
let toolParams = ProcessInfo.processInfo.environment["CLAUDE_TOOL_PARAMS"] ?? ""
let projectDir = ProcessInfo.processInfo.environment["CLAUDE_PROJECT_DIR"] ?? FileManager.default.currentDirectoryPath

// Determine action and file path from tool invocation
func extractFileOperation() -> (action: String, filePath: String)? {
    // Parse tool parameters to get file path
    if toolName == "Write" || toolName == "Edit" || toolName == "MultiEdit" {
        // These tools have file_path parameter
        if let data = toolParams.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let filePath = json["file_path"] as? String {
            // Check if file exists to determine add vs update
            let exists = FileManager.default.fileExists(atPath: filePath)
            return (action: "add", filePath: filePath)
        }
    } else if toolName == "Bash" {
        // Check for rm/delete commands in bash
        if let data = toolParams.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let command = json["command"] as? String {
            
            // Check for file removal commands
            if command.contains("rm ") || command.contains("rm -f") || command.contains("rm -rf") {
                // Extract file path from rm command
                let patterns = [
                    "rm\\s+(-[rf]+\\s+)?([^\\s]+\\.swift)",
                    "rm\\s+(-[rf]+\\s+)?\"([^\"]+\\.swift)\""
                ]
                
                for pattern in patterns {
                    if let regex = try? NSRegularExpression(pattern: pattern, options: []),
                       let match = regex.firstMatch(in: command, options: [], range: NSRange(command.startIndex..., in: command)) {
                        let lastRange = match.range(at: match.numberOfRanges - 1)
                        if let range = Range(lastRange, in: command) {
                            let filePath = String(command[range])
                            // Convert relative to absolute path if needed
                            let absolutePath = filePath.hasPrefix("/") ? filePath : "\(projectDir)/\(filePath)"
                            return (action: "remove", filePath: absolutePath)
                        }
                    }
                }
            }
            // Check for file creation commands (touch, echo >, etc)
            else if command.contains("touch ") || command.contains(" > ") {
                let patterns = [
                    "touch\\s+([^\\s]+\\.swift)",
                    "touch\\s+\"([^\"]+\\.swift)\"",
                    ">\\s*([^\\s]+\\.swift)",
                    ">\\s*\"([^\"]+\\.swift)\""
                ]
                
                for pattern in patterns {
                    if let regex = try? NSRegularExpression(pattern: pattern, options: []),
                       let match = regex.firstMatch(in: command, options: [], range: NSRange(command.startIndex..., in: command)) {
                        if let range = Range(match.range(at: 1), in: command) {
                            let filePath = String(command[range])
                            let absolutePath = filePath.hasPrefix("/") ? filePath : "\(projectDir)/\(filePath)"
                            return (action: "add", filePath: absolutePath)
                        }
                    }
                }
            }
        }
    }
    
    return nil
}

// Legacy: Extract file path from tool output (kept for fallback)
func extractFilePath(from output: String) -> String? {
    // Look for patterns like "File created successfully at: /path/to/file.swift"
    // or "File deleted successfully: /path/to/file.swift"
    let patterns = [
        "File created successfully at: ([^\\n]+)",
        "File updated successfully at: ([^\\n]+)",
        "File deleted successfully: ([^\\n]+)",
        "File removed successfully: ([^\\n]+)",
        "created successfully at: ([^\\n]+)",
        "updated successfully at: ([^\\n]+)",
        "deleted successfully: ([^\\n]+)",
        "removed successfully: ([^\\n]+)"
    ]
    
    for pattern in patterns {
        if let regex = try? NSRegularExpression(pattern: pattern, options: []),
           let match = regex.firstMatch(in: output, options: [], range: NSRange(output.startIndex..., in: output)) {
            if let range = Range(match.range(at: 1), in: output) {
                return String(output[range]).trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
    }
    
    // Also check if the output itself is a file path
    let trimmed = output.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.hasSuffix(".swift") && trimmed.hasPrefix("/") {
        return trimmed
    }
    
    return nil
}

// Check if auto-add is disabled for this project
func isAutoAddDisabled(projectDir: String) -> Bool {
    let fileManager = FileManager.default
    
    // Check for .no-xcode-autoadd file in project root
    let optOutFile = URL(fileURLWithPath: projectDir).appendingPathComponent(".no-xcode-autoadd").path
    if fileManager.fileExists(atPath: optOutFile) {
        return true
    }
    
    // Check for .claude/settings.json with autoadd disabled
    let claudeSettings = URL(fileURLWithPath: projectDir)
        .appendingPathComponent(".claude")
        .appendingPathComponent("settings.json").path
    
    if fileManager.fileExists(atPath: claudeSettings) {
        if let data = fileManager.contents(atPath: claudeSettings),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let xcodeAutoadd = json["xcodeAutoadd"] as? Bool,
           xcodeAutoadd == false {
            return true
        }
    }
    
    return false
}

// Find nearest .xcodeproj file
func findXcodeProject(from filePath: String) -> (projectPath: String, targetName: String)? {
    var currentDir = URL(fileURLWithPath: filePath).deletingLastPathComponent()
    let fileManager = FileManager.default
    
    for _ in 0..<10 { // Max 10 levels up
        do {
            let contents = try fileManager.contentsOfDirectory(at: currentDir, includingPropertiesForKeys: nil)
            
            for item in contents {
                if item.pathExtension == "xcodeproj" {
                    let projectPath = item.path
                    let pbxprojPath = item.appendingPathComponent("project.pbxproj").path
                    
                    if fileManager.fileExists(atPath: pbxprojPath) {
                        let targetName = item.deletingPathExtension().lastPathComponent
                        return (projectPath, targetName)
                    }
                }
            }
            
            // Move up one directory
            let parent = currentDir.deletingLastPathComponent()
            if parent.path == currentDir.path {
                break // Reached root
            }
            currentDir = parent
            
        } catch {
            break
        }
    }
    
    return nil
}

// Determine group path for the file
func determineGroupPath(filePath: String, projectDir: String, targetName: String) -> String {
    let fileURL = URL(fileURLWithPath: filePath)
    let projectURL = URL(fileURLWithPath: projectDir)
    
    // Get relative path components
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

// Main logic
guard let operation = extractFileOperation() else {
    // No file operation detected
    exit(0)
}

let filePath = operation.filePath
let action = operation.action

// Only process Swift files
guard filePath.hasSuffix(".swift") else {
    exit(0)
}

print("Detected \(action) operation for \(filePath)")

// Find nearest Xcode project
guard let projectInfo = findXcodeProject(from: filePath) else {
    print("No Xcode project found")
    exit(0)
}

let projectDirPath = URL(fileURLWithPath: projectInfo.projectPath).deletingLastPathComponent().path
let groupPath = determineGroupPath(filePath: filePath, projectDir: projectDirPath, targetName: projectInfo.targetName)

// Check if auto-add is disabled for this project
if isAutoAddDisabled(projectDir: projectDirPath) {
    print("Auto-add is disabled for this project")
    exit(0)
}

print("Found project: \(projectInfo.projectPath)")
print("Target: \(projectInfo.targetName)")
print("Group path: \(groupPath)")

// Check if XcodeProjectModifier is available
let modifierPath = "/tmp/XcodeProjectModifier/.build/release/XcodeProjectModifier"
guard FileManager.default.fileExists(atPath: modifierPath) else {
    print("XcodeProjectModifier not found. Make sure the MCP server has been used at least once.")
    exit(0)
}

// Run the modifier tool
let process = Process()
process.executableURL = URL(fileURLWithPath: modifierPath)
process.arguments = [
    projectInfo.projectPath,
    action,  // "add" or "remove"
    filePath,
    projectInfo.targetName,
    "--group-path", groupPath
]

do {
    try process.run()
    process.waitUntilExit()
    
    if process.terminationStatus == 0 {
        print("✅ Successfully \(action == "add" ? "added" : "removed") \(filePath) \(action == "add" ? "to" : "from") Xcode project")
    } else {
        print("Failed to \(action) file \(action == "add" ? "to" : "from") project (exit code: \(process.terminationStatus))")
    }
} catch {
    print("Error running XcodeProjectModifier: \(error)")
}