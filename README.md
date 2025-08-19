# MCP Xcode

A Model Context Protocol (MCP) server for Xcode - build, test, run, and manage Apple platform projects (iOS, macOS, tvOS, watchOS, visionOS).

## Version: 2.4.0

## Overview

This MCP server enables AI assistants and development tools to interact with Apple's development ecosystem directly. It provides comprehensive control over Xcode projects, Swift packages, and simulators, making it possible to build, test, and debug iOS/macOS applications without leaving your editor.

## Key Features

### Core Functionality
- **Multi-platform Support**: Build and test for iOS, macOS, tvOS, watchOS, and visionOS
- **Xcode Project Management**: Build and run Xcode projects and workspaces
- **Swift Package Manager**: Test SPM modules across all Apple platforms
- **Smart Simulator Management**: Automatically reuses running simulators, no unnecessary reboots
- **Visual UI Development**: Capture and view simulator screens directly in your editor
- **Comprehensive Testing**: Support for both XCTest and Swift Testing frameworks
- **Full Test Output**: Complete, untruncated test results for debugging
- **Swift 6.0 Support**: Compatible with the latest Swift language features
- **App Management**: Install and uninstall apps on simulators
- **Device Logs**: Retrieve and filter device logs for debugging
- **Build Maintenance**: Clean build folders, DerivedData, and test results without leaving Claude
- **Project Modification**: Add or remove files from Xcode projects programmatically
- **Dependency Management**: Manage Swift Package Manager dependencies
- **SwiftUI Previews**: Generate previews of SwiftUI views by rendering them in simulators

### Production Ready
- **Input Validation**: All tool arguments are validated using Zod schemas for type safety and clear error messages
- **Structured Logging**: Pino-based logging system with environment-aware configuration
- **Graceful Shutdown**: Proper cleanup handling for SIGTERM and SIGINT signals
- **Error Handling**: Comprehensive error handling with detailed error messages
- **Test Coverage**: Comprehensive test coverage with unit, integration, and end-to-end tests
- **CI/CD Pipeline**: Automated testing via GitHub Actions on all pushes and pull requests

## Installation

### Quick Setup (Recommended)

#### Global Installation

```bash
# Install globally
npm install -g mcp-xcode

# Run interactive setup
mcp-xcode setup
```

The setup wizard will:
- Configure the MCP server (globally or per-project)
- Optionally set up auto-add hooks for Swift files
- Build necessary helper tools

#### Project-specific Installation

```bash
# In your Xcode project directory
npm install mcp-xcode
npx mcp-xcode setup
```

### Manual Configuration

If you prefer manual setup, add to your Claude configuration:

#### Global (~/.claude/claude_desktop_config.json)

```json
{
  "mcpServers": {
    "mcp-xcode": {
      "type": "stdio",
      "command": "mcp-xcode",
      "args": ["serve"],
      "env": {}
    }
  }
}
```

#### Project-specific (.claude/settings.json)

```json
{
  "mcpServers": {
    "mcp-xcode": {
      "type": "stdio",
      "command": "npx",
      "args": ["mcp-xcode", "serve"],
      "env": {}
    }
  }
}
```

After updating the configuration, restart Claude Code for changes to take effect.

## Running Tests

```bash
npm test              # Run all tests
npm run test:unit     # Run unit tests only
npm run test:integration  # Run integration tests
npm run test:coverage # Run tests with coverage report
```

## Usage

The server runs using stdio transport and can be used with any MCP-compatible client like Claude Desktop, VS Code extensions, or custom clients.

### Available Tools

#### Project Management

- **`build_project`**: Build an Apple platform project (without running)
  - `projectPath`: Path to .xcodeproj or .xcworkspace
  - `scheme`: Xcode scheme to build
  - `platform`: Target platform (iOS, macOS, tvOS, watchOS, visionOS)
  - `deviceId`: Simulator device name or UDID (optional)
  - `configuration`: Debug or Release (default: Debug)

- **`run_project`**: Build and run an Apple platform project
  - `projectPath`: Path to .xcodeproj or .xcworkspace
  - `scheme`: Xcode scheme to build
  - `platform`: Target platform (iOS, macOS, tvOS, watchOS, visionOS)
  - `deviceId`: Simulator device name or UDID (optional)
  - `configuration`: Debug or Release (default: Debug)

- **`test_project`**: Run tests for a project
  - All parameters from `run_project` plus:
  - `testTarget`: Specific test target (e.g., "MyAppTests")
  - `testFilter`: Filter for specific test methods

- **`test_spm_module`**: Test a Swift Package Manager module
  - `packagePath`: Path to the Swift package
  - `platform`: Target platform (default: macOS)
  - `testFilter`: Filter for specific tests
  - `osVersion`: OS version for testing

#### Project Information

- **`list_schemes`**: List all schemes in a project or workspace
  - `projectPath`: Path to .xcodeproj or .xcworkspace
  - Returns: Array of scheme names

- **`get_build_settings`**: Get build settings for a scheme
  - `projectPath`: Path to .xcodeproj or .xcworkspace
  - `scheme`: Xcode scheme name
  - `platform`: Target platform (optional, default: iOS)
  - `configuration`: Debug or Release (optional)
  - Returns: Dictionary of build settings

- **`get_project_info`**: Get comprehensive project information
  - `projectPath`: Path to .xcodeproj or .xcworkspace
  - Returns: Project name, schemes, targets, and configurations

- **`list_targets`**: List all targets in a project
  - `projectPath`: Path to .xcodeproj or .xcworkspace
  - Returns: Array of target names

#### Advanced Project Management

- **`modify_project`**: Add or remove files from an Xcode project
  - `projectPath`: Path to .xcodeproj file
  - `action`: "add" or "remove"
  - `filePath`: Path to the file to add/remove
  - `targetName`: Name of the target to modify
  - `groupPath`: Group path for organizing files (optional, e.g., "Sources/Models")
  - Note: Uses Swift XcodeProj package internally for safe project modifications

- **`manage_dependencies`**: Manage Swift Package Manager dependencies
  - `projectPath`: Path to .xcodeproj or Package.swift
  - `action`: "list", "resolve", "update", "add", or "remove"
  - `packageURL`: URL of the Swift package (for add action)
  - `packageName`: Name of the package (for remove action)
  - `version`: Version requirement (optional, e.g., "1.0.0", "from: 1.0.0")

- **`swiftui_preview`**: Generate a preview of a SwiftUI view
  - `swiftFilePath`: Path to the SwiftUI view file
  - `previewName`: Name of the preview to render (optional, if multiple)
  - `deviceName`: Device to preview on (optional, default: "iPhone 15 Pro")
  - `colorScheme`: "light" or "dark" (optional)
  - Returns: Screenshot of the rendered SwiftUI view as base64 image data

#### Archive & Export

- **`archive_project`**: Create an archive of your project
  - `projectPath`: Path to .xcodeproj or .xcworkspace
  - `scheme`: Xcode scheme to archive
  - `platform`: Target platform (default: iOS)
  - `configuration`: Release or Debug (default: Release)
  - `archivePath`: Custom archive path (optional)
  - Returns: Path to created .xcarchive

- **`export_ipa`**: Export an IPA from an archive
  - `archivePath`: Path to .xcarchive
  - `exportPath`: Custom export directory (optional)
  - `exportMethod`: development, app-store, ad-hoc, or enterprise (default: development)
  - Returns: Path to exported IPA

#### Simulator Management

- **`list_simulators`**: List available simulators
  - `showAll`: Show unavailable simulators too
  - `platform`: Filter by platform

- **`boot_simulator`**: Boot a specific simulator
  - `deviceId`: Device UDID or name

- **`shutdown_simulator`**: Shutdown a simulator
  - `deviceId`: Device UDID or name

#### App Management

- **`install_app`**: Install an app bundle on simulator
  - `appPath`: Path to .app bundle
  - `deviceId`: Device UDID or name (optional, uses booted device)

- **`uninstall_app`**: Uninstall an app by bundle ID
  - `bundleId`: Bundle identifier of the app
  - `deviceId`: Device UDID or name (optional, uses booted device)

#### Debugging & UI Development

- **`view_simulator_screen`**: Capture and return simulator screen as image data
  - `deviceId`: Device UDID or name (optional, uses booted device)
  - Returns: Base64-encoded PNG image data that can be displayed directly

- **`get_device_logs`**: Retrieve device logs
  - `deviceId`: Device UDID or name (optional, uses booted device)
  - `predicate`: Log filter predicate
  - `last`: Time interval (e.g., "1m", "5m", "1h")

#### Build Maintenance

- **`clean_build`**: Clean build artifacts, DerivedData, or test results
  - `projectPath`: Path to .xcodeproj or .xcworkspace (optional for DerivedData-only cleaning)
  - `scheme`: Xcode scheme (optional)
  - `platform`: Target platform (default: iOS)
  - `configuration`: Debug or Release (default: Debug)
  - `cleanTarget`: What to clean - options:
    - `"build"`: Run `xcodebuild clean` (default)
    - `"derivedData"`: Remove DerivedData folder
    - `"testResults"`: Clear only test results
    - `"all"`: Clean everything
  - `derivedDataPath`: Path to DerivedData (default: ./DerivedData)

## Platform Support

### iOS
- Requires iOS Simulator
- Default device: iPhone 16 Pro
- Supports iOS 17+

### macOS
- No simulator required (runs natively)
- Tests run directly on host machine
- Supports macOS 14+

### tvOS
- Requires tvOS Simulator
- Default device: Apple TV

### watchOS
- Requires watchOS Simulator
- Default device: Apple Watch Series 9 (45mm)

### visionOS
- Requires visionOS Simulator
- Default device: Apple Vision Pro

## Architecture

The server follows SOLID principles with modular, class-based tool architecture:

### Core Components
- **`index.ts`**: MCP server with tool registry and request handling
- **`types.ts`**: Type definitions and interfaces
- **`logger.ts`**: Structured logging with Pino, including test-aware logging
- **`platformHandler.ts`**: Platform-specific configuration
- **`simulatorManager.ts`**: Simulator lifecycle management
- **`xcodeBuilder.ts`**: Build and test operations with dependency injection

### Tool Architecture
Each tool is a self-contained class in the `tools/` directory:
- **Individual tool classes**: Each tool implements its own validation, execution logic, and MCP definition
- **`validators.ts`**: Shared validation schemas for common patterns (paths, platforms, configurations)
- **`XcodeBuilderAdapter.ts`**: Adapter pattern for handling static/instance method compatibility
- **No inheritance**: Each tool is independent, avoiding complex hierarchies
- **Dependency injection**: Tools accept dependencies in constructors for testability

## Example Usage

### Test an iOS App
```json
{
  "tool": "test_project",
  "arguments": {
    "projectPath": "/path/to/MyApp.xcodeproj",
    "scheme": "MyApp",
    "platform": "iOS",
    "testTarget": "MyAppTests"
  }
}
```

### View Simulator Screen for UI Development
```json
{
  "tool": "view_simulator_screen",
  "arguments": {
    "deviceId": "iPhone 16 Pro"
  }
}
```

### Build a macOS App
```json
{
  "tool": "run_project",
  "arguments": {
    "projectPath": "/path/to/MacApp.xcodeproj",
    "scheme": "MacApp",
    "platform": "macOS",
    "configuration": "Release"
  }
}
```

### Test a Swift Package with Swift Testing
```json
{
  "tool": "test_spm_module",
  "arguments": {
    "packagePath": "/path/to/MyPackage",
    "platform": "macOS"
  }
}
```

### List All iOS Simulators
```json
{
  "tool": "list_simulators",
  "arguments": {
    "platform": "iOS",
    "showAll": true
  }
}
```

### Clean Build Folder and DerivedData
```json
{
  "tool": "clean_build",
  "arguments": {
    "projectPath": "/path/to/MyApp.xcodeproj",
    "scheme": "MyApp",
    "cleanTarget": "all"
  }
}
```

## Test Framework Support

The server automatically detects and properly parses output from:

- **XCTest**: Traditional Objective-C/Swift testing framework
- **Swift Testing**: New Swift 6.0+ testing framework with `@Test` annotations

Both frameworks are fully supported with accurate test counting and failure detection.

## Requirements

- macOS 14.0 or later
- Xcode 15.0 or later
- Node.js 18+
- Xcode Command Line Tools
- Simulators for target platforms (iOS, tvOS, watchOS, visionOS)

## Claude Code Hooks for Auto-Adding Swift Files

### Automatic Xcode Project Updates

You can configure Claude Code to automatically add new Swift files to your Xcode project whenever they're created. This eliminates the manual step of adding files to targets after Claude creates them.

### Setup

The easiest way is to use the setup wizard:

```bash
mcp-xcode setup
```

This will configure the hook automatically. Choose whether to install globally (works for all projects) or locally (project-specific).

### How It Works

- When Claude creates or edits a file using the Write or Edit tools
- If the file is a `.swift` file
- The hook searches for the nearest `.xcodeproj` file (up to 10 directories up)
- If found, it automatically adds the Swift file to the appropriate target
- The file is placed in a group structure matching its directory location
- Projects can opt-out by creating a `.no-xcode-autoadd` file in the project root

### Features

- **Smart Target Detection**: Automatically determines the target name from the project
- **Intelligent Grouping**: Places files in groups matching their directory structure
- **Non-intrusive**: Failures don't affect the file creation process
- **Swift-only**: Only processes `.swift` files to avoid cluttering projects

### Requirements

- The MCP server must have been used at least once (to build the helper tool)
- The project must use traditional Xcode groups (not Xcode 16's synchronized groups)

### Opting Out

Projects can disable auto-add in two ways:

1. Create a `.no-xcode-autoadd` file in the project root:
   ```bash
   touch .no-xcode-autoadd
   ```

2. Set `xcodeAutoadd: false` in `.claude/settings.json`:
   ```json
   {
     "xcodeAutoadd": false
   }
   ```

### Troubleshooting

If files aren't being added automatically:

1. Run `mcp-xcode setup` to ensure proper configuration
2. Ensure your project uses traditional groups (not Xcode 16's synchronized groups)
3. Check that no opt-out file exists in your project
4. Check Claude Code logs for any error messages

## Development

### Building
```bash
npm run build
```

### Testing
```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests
npm run test:coverage # With coverage report
```

### Project Structure
```
mcp-xcode/
├── src/
│   ├── index.ts              # MCP server entry point with graceful shutdown
│   ├── types.ts              # TypeScript type definitions
│   ├── validation.ts         # Zod schemas for input validation
│   ├── logger.ts             # Structured logging with Pino
│   ├── platformHandler.ts    # Platform abstraction layer
│   ├── simulatorManager.ts   # Simulator management
│   ├── xcodeBuilder.ts       # Build and test operations
│   ├── tools/               # Individual tool classes
│   │   ├── index.ts         # Tool exports
│   │   ├── validators.ts    # Shared validation schemas
│   │   ├── XcodeBuilderAdapter.ts  # Adapter for dependency injection
│   │   └── ... (21 tool classes)
│   └── __tests__/           # Test suites
│       ├── unit/            # Unit tests with dependency injection
│       ├── integration/     # Integration tests
│       └── e2e/             # End-to-end tests for all 21 tools
├── dist/                    # Compiled JavaScript
├── test_artifacts/          # Test projects for validation
├── .github/
│   └── workflows/
│       └── ci.yml          # GitHub Actions CI/CD pipeline
└── README.md
```

## Contributing

Contributions are welcome! Please ensure:
- All tests pass (`npm test`)
- Code follows existing patterns and SOLID principles
- New features include appropriate tests
- Documentation is updated

## License

MIT