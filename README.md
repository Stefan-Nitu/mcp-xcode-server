# MCP Xcode

A Model Context Protocol (MCP) server for Xcode - build, test, run, and manage Apple platform projects (iOS, macOS, tvOS, watchOS, visionOS).

## Version: 0.6.0 (Beta)

## Overview

This MCP server enables AI assistants and development tools to interact with Apple's development ecosystem directly. It provides comprehensive control over Xcode projects, Swift packages, and simulators, making it possible to build, test, and debug iOS/macOS applications without leaving your editor.

### Beta Status
**⚠️ This project is in beta.** While core functionality is stable and well-tested, approximately 48% of tools have been fully validated. See [test.md](test.md) for detailed validation status.

### Recent Improvements (v0.6.0)
- **Comprehensive Error Detection**: Detects and reports compile errors, scheme errors, code signing issues, provisioning problems, and configuration errors
- **Enhanced Error Display**: All errors shown with clear formatting, file locations, and actionable suggestions (e.g., "Check available schemes with list_schemes tool")
- **Persistent Logging**: All operations save full logs to `~/.mcp-xcode-server/logs/` with 7-day retention
- **Error Deduplication**: Compile errors shown only once even when building for multiple architectures
- **Unified Architecture**: Consolidated build and test operations into cohesive Xcode and SwiftPackage utility classes
- **Enhanced Device Management**: Modular simulator device management with clean separation of concerns
- **Unified Test Parser**: Strategy pattern-based test output parsing supporting both XCTest and Swift Testing frameworks
- **Security Enhancements**: Comprehensive input validation with command injection protection

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
- **Xcode Sync Hook**: Automatically sync file operations (add/remove/move) with Xcode projects
- **Dependency Management**: Manage Swift Package Manager dependencies

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
npm install -g mcp-xcode-server

# Run interactive setup
mcp-xcode-server setup
```

The setup wizard will:
- Configure the MCP server (globally or per-project)
- Optionally set up Xcode sync hooks for file operations
- Build necessary helper tools

#### Project-specific Installation

```bash
# In your Xcode project directory
npm install mcp-xcode-server
npx mcp-xcode-server setup
```

### Manual Configuration

If you prefer manual setup, add to your Claude configuration:

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

After updating the configuration, restart Claude Code for changes to take effect.

## Xcode Sync Hook

The MCP Xcode server includes an automatic file synchronization hook that keeps your Xcode projects in sync with file system changes made by Claude Code.

### Features

- **Automatic Detection**: Detects when files are created, modified, deleted, or moved via Claude Code tools (Write, Edit, MultiEdit, Bash)
- **File Operations Support**:
  - File creation (Write tool, `touch`, `echo >` commands)
  - File deletion (`rm` commands)
  - File moves/renames (`mv` commands)
- **Smart File Type Handling**:
  - Source files (.swift, .m, .mm, .c, .cpp) → Added to sources build phase
  - Resources (.png, .json, .plist, .xib, .storyboard) → Added to resources build phase
  - Documentation (.md, .txt) → Added to project only (visible but not compiled)
  - Frameworks (.framework, .a, .dylib) → Added to frameworks build phase
- **Group Management**: Automatically creates groups to match your folder structure
- **Opt-out Support**: 
  - Create `.no-xcode-sync` or `.no-xcode-autoadd` file in project root to disable
  - Or set `"xcodeSync": false` (or `"xcodeAutoadd": false` for legacy) in `.claude/settings.json`

### Setup

The hook is configured automatically when you run `mcp-xcode-server setup`. To manually configure:

```json
// In ~/.claude/settings.json or .claude/settings.json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/node_modules/mcp-xcode-server/scripts/xcode-sync.swift"
          }
        ]
      }
    ]
  }
}
```

### Supported File Types

- **Source Files**: .swift, .m, .mm, .c, .cpp, .cc, .cxx
- **Headers**: .h, .hpp, .hxx
- **Resources**: .png, .jpg, .jpeg, .gif, .pdf, .svg, .json, .plist, .xcassets, .storyboard, .xib, .strings
- **Documentation**: .md, .txt, .rtf
- **Configuration**: .xcconfig, .entitlements
- **Web**: .html, .css, .js, .ts, .tsx, .jsx
- **Data**: .xml, .yaml, .yml, .toml

## Running Tests

```bash
npm test              # Run all tests
npm run test:unit     # Run unit tests only
npm run test:e2e      # Run end-to-end tests
npm run test:coverage # Run tests with coverage report
```

## Usage

The server runs using stdio transport and can be used with any MCP-compatible client like Claude Desktop, VS Code extensions, or custom clients.

### Error Handling and Logging

#### Comprehensive Error Detection
The server detects and clearly reports various types of build errors:

##### Compile Errors
- **File location** with line and column numbers
- **Error messages** with proper formatting
- **Warning support** with different icons (❌ for errors, ⚠️ for warnings)
- **Deduplication** - errors shown only once even when building for multiple architectures

Example:
```
❌ Build failed with 1 error

❌ ContentView.swift:52:23
   Cannot convert value of type 'Int' to expected argument type 'String'

Platform: iOS
Configuration: Debug
Scheme: MyApp

📁 Full logs saved to: ~/.mcp-xcode-server/logs/2025-01-27/build_MyApp_20250127_143052.log
```

##### Build Configuration Errors
- **Scheme not found** - with suggestion to use `list_schemes` tool
- **Configuration not found** - e.g., using "Production" when only Debug/Release exist
- **Platform incompatibility** - trying to build for unsupported platform
- **Project not found** - invalid project or workspace path

Example:
```
❌ Build failed

📍 Scheme not found: "NonExistentScheme"
   The specified scheme does not exist in the project
   💡 Check available schemes with list_schemes tool

Platform: iOS
Configuration: Debug

📁 Full logs saved to: ~/.mcp-xcode-server/logs/2025-01-27/build_error_20250127_143052.log
```

##### Code Signing & Provisioning Errors
- **Missing certificates** - no valid signing identity found
- **Provisioning profile issues** - profile not found or capability mismatches
- **Team ID problems** - missing or invalid development team
- **Entitlements conflicts** - profile doesn't support required capabilities

##### Dependency Errors
- **Missing modules** - Swift Package or CocoaPods dependencies not found
- **Version conflicts** - incompatible dependency versions
- **Import failures** - unable to find modules in scope

#### Persistent Logging
The server maintains comprehensive logs for all operations:
- **Location**: `~/.mcp-xcode-server/logs/`
- **Organization**: Daily folders (e.g., `2025-01-27/`)
- **Retention**: 7-day automatic cleanup
- **Content**: Complete xcodebuild/swift output, test results, and metadata

This dual approach ensures:
1. **MCP output** is concise and actionable for immediate feedback
2. **Full logs** are preserved for detailed debugging when needed

### Available Tools

#### Project Management

- **`build_xcode`**: Build an Xcode project or workspace
  - `projectPath`: Path to .xcodeproj or .xcworkspace
  - `scheme`: Xcode scheme to build (required)
  - `platform`: Target platform (iOS, macOS, tvOS, watchOS, visionOS) (default: iOS)
  - `deviceId`: Simulator device name or UDID (optional)
  - `configuration`: Build configuration (e.g., Debug, Release, Beta, Staging) (default: Debug)

- **`build_swift_package`**: Build a Swift Package Manager package
  - `packagePath`: Path to Package.swift or package directory
  - `configuration`: Build configuration (Debug or Release) (default: Debug)
  - `target`: Build specific target (optional)
  - `product`: Build specific product (optional)

- **`run_xcode`**: Build and run an Xcode project or workspace
  - `projectPath`: Path to .xcodeproj or .xcworkspace
  - `scheme`: Xcode scheme to build and run (required)
  - `platform`: Target platform (iOS, macOS, tvOS, watchOS, visionOS) (default: iOS)
  - `deviceId`: Simulator device name or UDID (optional)
  - `configuration`: Build configuration (e.g., Debug, Release, Beta, Staging) (default: Debug)

- **`run_swift_package`**: Build and run a Swift Package Manager executable
  - `packagePath`: Path to Package.swift or package directory
  - `executable`: The executable product to run (optional, uses default if not specified)
  - `configuration`: Build configuration (Debug or Release) (default: Debug)
  - `arguments`: Arguments to pass to the executable (optional)

- **`test_xcode`**: Run tests for an Xcode project or workspace
  - `projectPath`: Path to .xcodeproj or .xcworkspace (required)
  - `scheme`: Xcode scheme to test (required)
  - `platform`: Target platform (iOS, macOS, tvOS, watchOS, visionOS) (default: iOS)
  - `deviceId`: Simulator device name or UDID (optional)
  - `configuration`: Build configuration (Debug or Release) (default: Debug)
  - `testTarget`: Specific test target to run (e.g., "MyAppTests" or "MyAppUITests") (optional)
  - `testFilter`: Filter for specific test classes or methods (e.g., "MyAppTests/UserTests" for a class, "MyAppTests/UserTests/testLogin" for a method) (optional)

- **`test_swift_package`**: Run tests for a Swift Package Manager package
  - `packagePath`: Path to Package.swift or package directory (required)
  - `configuration`: Build configuration (Debug or Release) (default: Debug)
  - `filter`: Filter for specific tests (e.g., "MyPackageTests.UserTests" for a class, "MyPackageTests.UserTests/testLogin" for a method) (optional)

#### Project Information

- **`list_schemes`**: List all available schemes in an Xcode project or workspace
  - `projectPath`: Path to .xcodeproj or .xcworkspace
  - Returns: JSON array of scheme names

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
  - Note: Uses Swift XcodeProj package internally for safe project modifications

- **`manage_dependencies`**: Manage Swift Package Manager dependencies
  - `projectPath`: Path to .xcodeproj or Package.swift
  - `action`: "list", "resolve", "update", "add", or "remove"
  - `packageURL`: URL of the Swift package (for add action)
  - `packageName`: Name of the package (for remove action)
  - `version`: Version requirement (optional, e.g., "1.0.0", "from: 1.0.0")

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
- Default device: Apple Watch Series 10 (46mm)

### visionOS
- Requires visionOS Simulator
- Default device: Apple Vision Pro

## Architecture

The server follows SOLID principles with a modular, class-based architecture that separates concerns and promotes testability:

### Core Components
- **`index.ts`**: MCP server with tool registry and request handling
- **`types.ts`**: Type definitions and interfaces
- **`logger.ts`**: Structured logging with Pino, including test-aware logging
- **`platformHandler.ts`**: Platform-specific configuration and destination management
- **`validation.ts`**: Comprehensive Zod schemas with security validation for all tool inputs
- **`config.ts`**: Centralized configuration management

### Utility Architecture
The server uses a clean separation between device management and build operations:

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
- **`XcodeBuild.ts`**: Xcode build and test execution
- **`SwiftPackage.ts`**: Swift Package Manager operations
- **`SwiftBuild.ts`**: Swift package build and test execution

#### Test Parsing (`utils/testParsing/`)
- **`TestOutputParser.ts`**: Main parser using strategy pattern
- **`XCTestParserStrategy.ts`**: Parser for XCTest framework output
- **`SwiftTestingParserStrategy.ts`**: Parser for Swift Testing framework output
- **`TestParserStrategy.ts`**: Strategy interface for test parsers

### Tool Architecture
Each tool is a self-contained class in the `tools/` directory implementing the `Tool` interface:
- **Individual tool classes**: Each tool encapsulates its own validation, execution logic, and MCP definition
- **No inheritance**: Tools are independent, avoiding complex hierarchies
- **Dependency injection**: Tools accept dependencies in constructors for testability
- **Consistent error handling**: All tools use structured validation and error reporting

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

### Build and Run a macOS App
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

The server uses a unified test parser with strategy pattern to automatically detect and properly parse output from:

- **XCTest**: Traditional Objective-C/Swift testing framework
  - Parses `Test Suite` and `Test Case` output formats
  - Supports both unit and UI tests
  - Handles multiple test bundle summaries
  
- **Swift Testing**: New Swift 6.0+ testing framework with `@Test` annotations
  - Parses the modern test output with symbols (◇, ✔, ✘)
  - Supports async tests and test suites
  - Compatible with Swift 6.0+ features

Both frameworks are fully supported with:
- Accurate test counting (passed/failed)
- Failing test name extraction
- Unified result format regardless of framework used
- Automatic framework detection based on output patterns

## Requirements

- macOS 14.0 or later
- Xcode 15.0 or later
- Node.js 18+
- Xcode Command Line Tools
- Simulators for target platforms (iOS, tvOS, watchOS, visionOS)

## Claude Code Hooks for Xcode File Sync

### Automatic Xcode Project Updates

You can configure Claude Code to automatically sync file operations with your Xcode project. This includes adding new files, removing deleted files, and handling file moves/renames, eliminating manual project maintenance.

### Setup

The easiest way is to use the setup wizard:

```bash
mcp-xcode setup
```

This will configure the hook automatically. Choose whether to install globally (works for all projects) or locally (project-specific).

### How It Works

- When Claude creates, edits, deletes, or moves files using Write, Edit, MultiEdit, or Bash tools
- If the file has a supported extension (Swift, Objective-C, resources, etc.)
- The hook searches for the nearest `.xcodeproj` file (up to 10 directories up)
- If found, it automatically syncs the file operation with the Xcode project
- Files are placed in groups matching their directory structure
- Projects can opt-out by creating a `.no-xcode-sync` file in the project root

### Features

- **Smart Target Detection**: Automatically determines the target name from the project
- **Intelligent Grouping**: Places files in groups matching their directory structure
- **Non-intrusive**: Failures don't affect file operations
- **Multi-format Support**: Handles source files, resources, documentation, and more
- **Operation Tracking**: Syncs additions, deletions, and moves/renames

### Requirements

- The MCP server must have been used at least once (to build the helper tool)
- The project must use traditional Xcode groups (not Xcode 16's synchronized groups)

### Opting Out

Projects can disable Xcode sync in several ways:

1. Create a `.no-xcode-sync` file in the project root:
   ```bash
   touch .no-xcode-sync
   ```

2. Create a `.no-xcode-autoadd` file (legacy, still supported):
   ```bash
   touch .no-xcode-autoadd
   ```

3. Set `xcodeSync: false` in `.claude/settings.json`:
   ```json
   {
     "xcodeSync": false
   }
   ```

4. Set `xcodeAutoadd: false` (legacy, still supported):
   ```json
   {
     "xcodeAutoadd": false
   }
   ```

### Logging

The MCP Xcode server maintains comprehensive logs for debugging and troubleshooting:

#### Log Location
Logs are saved to `~/.mcp-xcode-server/logs/` with daily rotation and 7-day retention.

#### Log Structure
```
~/.mcp-xcode-server/logs/
├── 2025-08-27/                    # Daily folder
│   ├── 14-30-15-test-MyApp.log    # Full xcodebuild output
│   ├── 14-30-15-test-xcresult-parsed-MyApp-debug.json  # Parsed test results
│   └── 14-35-22-build-MyApp.log   # Build output
└── latest-test.log -> ./2025-08-27/14-30-15-test-MyApp.log  # Symlink to latest
```

#### MCP Output Format
Tools provide clean, minimal output while saving full details to logs:

**Test Results:**
```
✅ Tests passed: 50 passed, 0 failed

Platform: iOS
Configuration: Debug

📁 Full logs saved to: ~/.mcp-xcode-server/logs/2025-08-27/14-30-15-test-MyApp.log
```

**Test Failures:**
```
❌ Tests failed: 48 passed, 2 failed

**Failing tests:**
• MyAppTests/testLogin()
  XCTAssertTrue failed: Expected true but got false
• MyAppTests/testDataParsing()
  XCTAssertEqual failed: ("expected") is not equal to ("actual")

Platform: iOS
Configuration: Debug

📁 Full logs saved to: ~/.mcp-xcode-server/logs/2025-08-27/14-35-15-test-MyApp.log
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
npm run test:e2e      # End-to-end tests
npm run test:coverage # With coverage report
```

#### Test Artifacts
The `test_artifacts/` directory contains real Xcode projects used for testing. **Important**: Any modifications to these test projects (e.g., adding test methods to `TestProjectXCTestTests.swift`) must be committed to Git. The test runner restores these projects to their pristine state before each test run, so uncommitted changes will be lost.

Example:
```bash
# After modifying test files
cd test_artifacts/TestProjectXCTest
git add .
git commit -m "Add test methods for filter testing"
```

### Project Structure
```
mcp-xcode/
├── src/
│   ├── index.ts              # MCP server entry point with graceful shutdown
│   ├── types.ts              # TypeScript type definitions
│   ├── validation.ts         # Zod schemas with security validation
│   ├── logger.ts             # Structured logging with Pino
│   ├── platformHandler.ts    # Platform abstraction layer
│   ├── config.ts            # Configuration management
│   ├── utils/               # Utility modules
│   │   ├── devices/         # Device management classes
│   │   │   ├── Devices.ts
│   │   │   ├── SimulatorDevice.ts
│   │   │   └── ... (component classes)
│   │   └── xcode/           # Build operation classes
│   │       ├── Xcode.ts
│   │       ├── XcodeProject.ts
│   │       └── SwiftPackage.ts
│   ├── tools/               # Individual tool classes
│   │   ├── index.ts         # Tool exports
│   │   └── ... (21 tool classes)
│   └── __tests__/           # Test suites
│       ├── unit/            # Unit tests with mocking
│       ├── integration/     # Integration tests
│       └── e2e/             # End-to-end tests
├── dist/                    # Compiled JavaScript
├── test_artifacts/          # Test projects for validation
├── docs/                    # Documentation
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