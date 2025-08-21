import Foundation
import XcodeProj
import PathKit
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
            print("Error: Target '\(targetName)' not found")
            throw ExitCode.failure
        }
        
        let fileName = URL(fileURLWithPath: filePath).lastPathComponent
        
        if action == "remove" {
            // Remove file reference
            if let fileRef = pbxproj.fileReferences.first(where: { $0.path == fileName || $0.path == filePath }) {
                pbxproj.delete(object: fileRef)
                print("Removed \(fileName) from project")
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
            
            print("Added \(fileName) to project")
        }
        
        try project.write(path: Path(projectPath))
    }
}

XcodeProjectModifier.main()