# MCP Xcode Server

A Model Context Protocol (MCP) server for Xcode - build, test, run, and manage Apple platform projects (iOS, macOS, tvOS, watchOS, visionOS).

## Version: 0.6.0 (Beta)

**⚠️ Beta Status:** Core functionality is stable with 57% of tools fully validated (12/21). See [test.md](test.md) for validation details.

## Overview

This MCP server enables AI assistants and development tools to interact with Apple's development ecosystem directly. It provides comprehensive control over Xcode projects, Swift packages, and simulators.

## Key Features

- **Multi-platform Support**: Build and test for iOS, macOS, tvOS, watchOS, and visionOS
- **Xcode Project Management**: Build, run, and test Xcode projects and workspaces
- **Swift Package Manager**: Full SPM support across all Apple platforms
- **Smart Simulator Management**: Automatically reuses running simulators
- **Visual UI Development**: Capture and view simulator screens directly
- **Comprehensive Testing**: Support for XCTest and Swift Testing frameworks
- **App Management**: Install and uninstall apps on simulators
- **Device Logs**: Retrieve and filter device logs for debugging
- **Build Maintenance**: Clean build folders, DerivedData, and test results
- **Xcode Sync Hook**: Automatically sync file operations with Xcode projects
- **Dependency Management**: Manage Swift Package Manager dependencies
- **Error Detection**: Comprehensive compile error, scheme error, and code signing issue reporting
- **Persistent Logging**: All operations save full logs to `~/.mcp-xcode-server/logs/` with 7-day retention

## Installation

### Prerequisites

- macOS 14.0 or later
- Xcode 15.0 or later
- Node.js 18+
- Xcode Command Line Tools
- Simulators for target platforms (iOS, tvOS, watchOS, visionOS)

### Quick Setup (Recommended)

#### Global Installation
```bash
# Install globally
npm install -g mcp-xcode-server

# Run interactive setup
mcp-xcode-server setup
```

#### Project-specific Installation
```bash
# In your Xcode project directory
npm install mcp-xcode-server
npx mcp-xcode-server setup
```

The setup wizard will:
- Configure the MCP server (globally or per-project)
- Optionally set up Xcode sync hooks for file operations
- Build necessary helper tools

### Manual Configuration

#### Global (~/.claude.json)
```json
{
  "mcpServers": {
    "mcp-xcode-server": {
      "type": "stdio",
      "command": "mcp-xcode-server",
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
    "mcp-xcode-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["mcp-xcode-server", "serve"],
      "env": {}
    }
  }
}
```

After updating configuration, restart Claude Code for changes to take effect.

## Available Tools

### Build & Run Tools

#### `build_xcode`
Build an Xcode project or workspace
- `projectPath`: Path to .xcodeproj or .xcworkspace
- `scheme`: Xcode scheme to build (required)
- `platform`: Target platform (default: iOS)
- `deviceId`: Simulator device name or UDID (optional)
- `configuration`: Build configuration (default: Debug)

#### `build_swift_package`
Build a Swift Package Manager package
- `packagePath`: Path to Package.swift or package directory
- `configuration`: Build configuration (Debug/Release, default: Debug)
- `target`: Specific target (optional)
- `product`: Specific product (optional)

#### `run_xcode`
Build and run an Xcode project or workspace
- `projectPath`: Path to .xcodeproj or .xcworkspace
- `scheme`: Xcode scheme to build and run (required)
- `platform`: Target platform (default: iOS)
- `deviceId`: Simulator device name or UDID (optional)
- `configuration`: Build configuration (default: Debug)

#### `run_swift_package`
Build and run a Swift Package Manager executable
- `packagePath`: Path to Package.swift or package directory
- `executable`: The executable product to run (optional)
- `configuration`: Build configuration (Debug/Release, default: Debug)
- `arguments`: Arguments to pass to the executable (optional)

### Testing Tools

#### `test_xcode`
Run tests for an Xcode project or workspace
- `projectPath`: Path to .xcodeproj or .xcworkspace (required)
- `scheme`: Xcode scheme to test (required)
- `platform`: Target platform (default: iOS)
- `deviceId`: Simulator device name or UDID (optional)
- `configuration`: Build configuration (default: Debug)
- `testTarget`: Specific test target (optional)
- `testFilter`: Filter for specific test classes or methods (optional)

#### `test_swift_package`
Run tests for a Swift Package Manager package
- `packagePath`: Path to Package.swift or package directory (required)
- `configuration`: Build configuration (Debug/Release, default: Debug)
- `filter`: Filter for specific tests (optional)

### Project Information Tools

#### `list_schemes`
List all available schemes in an Xcode project or workspace
- `projectPath`: Path to .xcodeproj or .xcworkspace
- Returns: JSON array of scheme names

#### `get_build_settings`
Get build settings for a scheme
- `projectPath`: Path to .xcodeproj or .xcworkspace
- `scheme`: Xcode scheme name
- `platform`: Target platform (optional, default: iOS)
- `configuration`: Debug or Release (optional)
- Returns: Dictionary of build settings

#### `get_project_info`
Get comprehensive project information
- `projectPath`: Path to .xcodeproj or .xcworkspace
- Returns: Project name, schemes, targets, and configurations

#### `list_targets`
List all targets in a project
- `projectPath`: Path to .xcodeproj or .xcworkspace
- Returns: Array of target names

### Simulator Management Tools

#### `list_simulators`
List available simulators
- `showAll`: Show unavailable simulators too
- `platform`: Filter by platform

#### `boot_simulator`
Boot a specific simulator
- `deviceId`: Device UDID or name

#### `shutdown_simulator`
Shutdown a simulator
- `deviceId`: Device UDID or name

#### `view_simulator_screen`
Capture and return simulator screen as image data
- `deviceId`: Device UDID or name (optional, uses booted device)
- Returns: Base64-encoded PNG image data

### App Management Tools

#### `install_app`
Install an app bundle on simulator
- `appPath`: Path to .app bundle
- `deviceId`: Device UDID or name (optional, uses booted device)

#### `uninstall_app`
Uninstall an app by bundle ID
- `bundleId`: Bundle identifier of the app
- `deviceId`: Device UDID or name (optional, uses booted device)

### Advanced Tools

#### `archive_project`
Create an archive of your project
- `projectPath`: Path to .xcodeproj or .xcworkspace
- `scheme`: Xcode scheme to archive
- `platform`: Target platform (default: iOS)
- `configuration`: Release or Debug (default: Release)
- `archivePath`: Custom archive path (optional)
- Returns: Path to created .xcarchive

#### `export_ipa`
Export an IPA from an archive
- `archivePath`: Path to .xcarchive
- `exportPath`: Custom export directory (optional)
- `exportMethod`: development, app-store, ad-hoc, or enterprise (default: development)
- Returns: Path to exported IPA

#### `manage_dependencies`
Manage Swift Package Manager dependencies
- `projectPath`: Path to .xcodeproj or Package.swift
- `action`: "list", "resolve", "update", "add", or "remove"
- `packageURL`: URL of the Swift package (for add action)
- `packageName`: Name of the package (for remove action)
- `version`: Version requirement (optional)

#### `get_device_logs`
Retrieve device logs
- `deviceId`: Device UDID or name (optional, uses booted device)
- `predicate`: Log filter predicate
- `last`: Time interval (e.g., "1m", "5m", "1h")

#### `clean_build`
Clean build artifacts, DerivedData, or test results
- `projectPath`: Path to .xcodeproj or .xcworkspace (optional for DerivedData-only cleaning)
- `scheme`: Xcode scheme (optional)
- `platform`: Target platform (default: iOS)
- `configuration`: Debug or Release (default: Debug)
- `cleanTarget`: What to clean:
  - `"build"`: Run `xcodebuild clean` (default)
  - `"derivedData"`: Remove DerivedData folder
  - `"testResults"`: Clear only test results
  - `"all"`: Clean everything
- `derivedDataPath`: Path to DerivedData (default: ./DerivedData)

## Xcode Sync Hook

Automatically syncs file operations with Xcode projects when using Claude Code.

### Features
- **Automatic Detection**: Detects file operations via Claude Code tools
- **Smart File Type Handling**:
  - Source files (.swift, .m, .mm, .c, .cpp) → Sources build phase
  - Resources (.png, .json, .plist, .xib, .storyboard) → Resources build phase
  - Documentation (.md, .txt) → Project only (visible but not compiled)
  - Frameworks (.framework, .a, .dylib) → Frameworks build phase
- **Group Management**: Creates groups matching folder structure
- **Opt-out Support**: Via `.no-xcode-sync` file or settings

### Supported File Types
- **Source**: .swift, .m, .mm, .c, .cpp, .cc, .cxx, .h, .hpp, .hxx
- **Resources**: .png, .jpg, .jpeg, .gif, .pdf, .svg, .json, .plist, .xcassets, .storyboard, .xib, .strings
- **Documentation**: .md, .txt, .rtf
- **Configuration**: .xcconfig, .entitlements
- **Web**: .html, .css, .js, .ts, .tsx, .jsx
- **Data**: .xml, .yaml, .yml, .toml

### Opting Out
Create a `.no-xcode-sync` file in the project root or set `xcodeSync: false` in `.claude/settings.json`.

## Error Handling

The server provides comprehensive error detection and reporting:

### Compile Errors
- File location with line and column numbers
- Clear error messages with proper formatting
- Deduplication across architectures
- Icons: ❌ for errors, ⚠️ for warnings

### Build Configuration Errors
- Scheme not found - with suggestion to use `list_schemes` tool
- Configuration not found
- Platform incompatibility
- Project not found

### Code Signing & Provisioning
- Missing certificates
- Provisioning profile issues
- Team ID problems
- Entitlements conflicts

### Dependency Errors
- Missing modules
- Version conflicts
- Import failures

## Logging

All operations save comprehensive logs to `~/.mcp-xcode-server/logs/`:
- **Organization**: Daily folders (e.g., `2025-01-27/`)
- **Retention**: 7-day automatic cleanup
- **Content**: Complete xcodebuild/swift output, test results, and metadata

## Platform Support

- **iOS**: Requires iOS Simulator (default: iPhone 16 Pro, iOS 17+)
- **macOS**: Runs natively on host machine (macOS 14+)
- **tvOS**: Requires tvOS Simulator (default: Apple TV)
- **watchOS**: Requires watchOS Simulator (default: Apple Watch Series 10 46mm)
- **visionOS**: Requires visionOS Simulator (default: Apple Vision Pro)

## Test Framework Support

Automatically detects and parses output from:
- **XCTest**: Traditional Objective-C/Swift testing framework
- **Swift Testing**: New Swift 6.0+ testing framework with `@Test` annotations

Both frameworks provide:
- Accurate test counting (passed/failed)
- Failing test name extraction
- Unified result format
- Automatic framework detection

## Example Usage

### Test an iOS App
```json
{
  "tool": "test_xcode",
  "arguments": {
    "projectPath": "/path/to/MyApp.xcodeproj",
    "scheme": "MyApp",
    "platform": "iOS",
    "testTarget": "MyAppTests"
  }
}
```

### View Simulator Screen
```json
{
  "tool": "view_simulator_screen",
  "arguments": {
    "deviceId": "iPhone 16 Pro"
  }
}
```

### Build and Run macOS App
```json
{
  "tool": "run_xcode",
  "arguments": {
    "projectPath": "/path/to/MacApp.xcodeproj",
    "scheme": "MacApp",
    "platform": "macOS",
    "configuration": "Release"
  }
}
```

### Test Swift Package
```json
{
  "tool": "test_swift_package",
  "arguments": {
    "packagePath": "/path/to/MyPackage",
    "configuration": "Debug"
  }
}
```

## Architecture

The server follows SOLID principles with modular, class-based architecture:

### Core Components
- **`index.ts`**: MCP server with tool registry and request handling
- **`types.ts`**: Type definitions and interfaces
- **`logger.ts`**: Structured logging with Pino
- **`platformHandler.ts`**: Platform-specific configuration
- **`validation.ts`**: Zod schemas with security validation
- **`config.ts`**: Centralized configuration management
- **`cli.ts`**: Command-line interface for setup

### Utility Modules

#### Device Management (`utils/devices/`)
- **`Devices.ts`**: Device discovery and management
- **`SimulatorDevice.ts`**: Unified simulator interface
- **`SimulatorBoot.ts`**: Boot/shutdown operations
- **`SimulatorApps.ts`**: App installation and management
- **`SimulatorUI.ts`**: UI operations (screenshots, appearance)
- **`SimulatorInfo.ts`**: Device state and logging
- **`SimulatorReset.ts`**: Device reset operations

#### Build Operations (`utils/projects/`)
- **`Xcode.ts`**: Factory for Xcode operations
- **`XcodeProject.ts`**: Xcode project building and running
- **`XcodeBuild.ts`**: Build and test execution
- **`SwiftPackage.ts`**: Swift Package Manager operations
- **`SwiftBuild.ts`**: Swift package build and test execution

### Tool Architecture
Each tool in the `tools/` directory is a self-contained class implementing the Tool interface:
- Individual tool classes encapsulate validation, execution logic, and MCP definition
- No inheritance - tools are independent
- Dependency injection for testability
- Consistent error handling with structured validation

## Development

### Building
```bash
npm run build
```

### Testing
```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:e2e      # End-to-end tests
npm run test:coverage # With coverage report
```

### Test Artifacts
The `test_artifacts/` directory contains real Xcode projects used for testing. Any modifications to these test projects must be committed to Git as the test runner restores them to pristine state before each test run.

### CI/CD
GitHub Actions pipeline runs on all pushes and pull requests:
- Tests across Node.js 18.x, 20.x, 22.x
- TypeScript compilation checks
- Test coverage reporting
- Automated releases on main branch

## Production Features

- **Input Validation**: All tool arguments validated using Zod schemas
- **Structured Logging**: Pino-based logging with environment-aware configuration
- **Graceful Shutdown**: Proper cleanup handling for SIGTERM and SIGINT signals
- **Error Handling**: Comprehensive error handling with detailed messages
- **Test Coverage**: Unit, integration, and end-to-end tests
- **Security**: Command injection protection and path validation

## Contributing

Contributions are welcome! Please ensure:
- All tests pass (`npm test`)
- Code follows existing patterns and SOLID principles
- New features include appropriate tests
- Documentation is updated

## License

MIT