#!/usr/bin/env swift

// Auto-add Swift files to Xcode projects
// This script is meant to be used as a Claude Code PostToolUse hook

import Foundation

// Get environment variables from Claude Code
let toolOutput = ProcessInfo.processInfo.environment["CLAUDE_TOOL_OUTPUT"] ?? ""
let projectDir = ProcessInfo.processInfo.environment["CLAUDE_PROJECT_DIR"] ?? FileManager.default.currentDirectoryPath

// Extract file path from tool output
func extractFilePath(from output: String) -> String? {
    // Look for patterns like "File created successfully at: /path/to/file.swift"
    // or "File updated successfully at: /path/to/file.swift"
    let patterns = [
        "File created successfully at: ([^\\n]+)",
        "File updated successfully at: ([^\\n]+)",
        "created successfully at: ([^\\n]+)",
        "updated successfully at: ([^\\n]+)"
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
guard let filePath = extractFilePath(from: toolOutput) else {
    // No file path found in output
    exit(0)
}

// Only process Swift files
guard filePath.hasSuffix(".swift") else {
    exit(0)
}

print("Checking if \(filePath) should be added to Xcode project...")

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
    "add",
    filePath,
    projectInfo.targetName,
    "--group-path", groupPath
]

do {
    try process.run()
    process.waitUntilExit()
    
    if process.terminationStatus == 0 {
        print("✅ Successfully added \(filePath) to Xcode project")
    } else {
        print("Failed to add file to project (exit code: \(process.terminationStatus))")
    }
} catch {
    print("Error running XcodeProjectModifier: \(error)")
}