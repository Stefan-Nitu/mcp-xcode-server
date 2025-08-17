# MCP Apple Simulator

A Model Context Protocol (MCP) server for building, running, and testing Apple platform projects (iOS, macOS, tvOS, watchOS, visionOS).

## Version: 2.1.0

## Overview

This MCP server enables AI assistants and development tools to interact with Apple's development ecosystem directly. It provides comprehensive control over Xcode projects, Swift packages, and simulators, making it possible to build, test, and debug iOS/macOS applications without leaving your editor.

## Key Features

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

## Installation

### 1. Install Dependencies and Build

```bash
npm install
npm run build
```

### 2. Configure MCP Server

To make the Apple Simulator MCP server available to your MCP client (e.g., Claude Desktop), you need to add it to your configuration.

#### For Claude Desktop

Add the following to your `~/.claude.json` file:

```json
{
  "mcpServers": {
    "apple-simulator": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/mcp-apple-simulator/dist/index.js"
      ],
      "env": {}
    }
  }
}
```

Replace `/path/to/mcp-apple-simulator` with the actual path to where you cloned this repository.

#### Using Claude CLI (if available)

```bash
claude mcp add apple-simulator --scope user node /path/to/mcp-apple-simulator/dist/index.js
```

After updating the configuration, restart your MCP client for the changes to take effect.

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

The server follows SOLID principles with modular components:

- **`types.ts`**: Type definitions and interfaces
- **`platformHandler.ts`**: Platform-specific configuration (Open/Closed Principle)
- **`simulatorManager.ts`**: Simulator lifecycle management (Single Responsibility)
- **`xcodeBuilder.ts`**: Build and test operations with full output support
- **`index.ts`**: MCP server setup and request handling

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
mcp-apple-simulator/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── types.ts              # TypeScript type definitions
│   ├── platformHandler.ts    # Platform abstraction layer
│   ├── simulatorManager.ts   # Simulator management
│   ├── xcodeBuilder.ts       # Build and test operations
│   └── __tests__/           # Test suites
│       ├── unit/            # Unit tests
│       ├── integration/     # Integration tests
│       └── e2e/            # End-to-end tests
├── dist/                    # Compiled JavaScript
├── examples/               # Usage examples
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