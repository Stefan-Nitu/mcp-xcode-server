# MCP Xcode Server

[![CI](https://github.com/stefan-nitu/mcp-xcode-server/actions/workflows/ci.yml/badge.svg)](https://github.com/stefan-nitu/mcp-xcode-server/actions/workflows/ci.yml)

A Model Context Protocol (MCP) server that enables AI assistants to build, test, run, and manage Apple platform projects through natural language interactions.

## Version: 0.6.0

## Purpose

This MCP server bridges the gap between AI assistants and Apple's development ecosystem. It allows AI tools like Claude to directly execute Xcode and Swift Package Manager commands, enabling automated development workflows without manual intervention. The server is designed for token efficiency, providing concise output while maintaining comprehensive error reporting and debugging capabilities.

## Why Use MCP Xcode Server?

### Key Advantages

- **AI-Native Development**: Enables AI assistants to build, test, and run iOS/macOS apps directly
- **Token Efficiency**: Optimized output shows only essential information (errors, warnings, test results)
- **Smart Error Handling**: Parses build errors and provides actionable suggestions
- **Visual Debugging**: Capture simulator screenshots to verify UI changes
- **Automatic Simulator Management**: Intelligently reuses running simulators to save time
- **Xcode Integration**: Auto-syncs file operations with Xcode projects via hooks
- **Persistent Logging**: All operations saved to `~/.mcp-xcode-server/logs/` for debugging
- **Multi-Platform**: Supports iOS, macOS, tvOS, watchOS, and visionOS from a single interface

### Use Cases

- **Automated Testing**: AI can run your test suites and analyze failures
- **Build Verification**: Quickly verify code changes compile across platforms
- **UI Development**: Build and screenshot apps to verify visual changes
- **Dependency Management**: Add, update, or remove Swift packages programmatically
- **Cross-Platform Development**: Test the same code on multiple Apple platforms
- **CI/CD Integration**: Automate build and test workflows through natural language

## Limitations

### What It Can't Do

- **No SwiftUI Previews**: Xcode's live preview requires the full IDE
- **No Interactive UI Testing**: Cannot simulate user interactions (taps, swipes)
- **No Physical Devices**: Simulator-only for iOS/tvOS/watchOS/visionOS
- **No Debugging**: No breakpoints, step-through debugging, or LLDB access
- **No Xcode UI Features**: Project configuration, storyboard editing require Xcode
- **Platform Requirements**: Requires macOS 14+, Xcode 16+, iOS 17+ simulators

### When You Still Need Xcode

- Designing UI with Interface Builder or SwiftUI previews
- Debugging with breakpoints and variable inspection
- Profiling with Instruments
- Managing certificates and provisioning profiles
- Testing on physical devices
- Using Xcode-specific features (Playgrounds, AR tools, etc.)

## Core Features

### Build & Test Automation
- Build and run Xcode projects/workspaces
- Execute Swift Package Manager packages
- Run XCTest and Swift Testing suites
- **Xcode projects**: Support for custom build configurations (Debug, Release, Beta, Staging, etc.)
- **Swift packages**: Standard SPM configurations (Debug/Release only - SPM limitation)

### Simulator Management
- List and boot simulators for any Apple platform
- Capture screenshots for visual verification
- Install/uninstall apps
- Retrieve device logs with filtering

### Error Intelligence
- **Compile Errors**: Shows file, line, column with error message
- **Scheme Errors**: Suggests using `list_schemes` tool
- **Code Signing**: Identifies certificate and provisioning issues
- **Dependencies**: Detects missing modules and version conflicts

### File Sync Hooks
- Automatically syncs file operations with Xcode projects
- Intelligently assigns files to correct build phases (Sources, Resources, etc.)
- Respects `.no-xcode-sync` opt-out files
- Maintains proper group structure in Xcode

## Installation

### Prerequisites

- macOS 14.0 or later
- Xcode 16.0 or later
- Node.js 18+
- Xcode Command Line Tools
- Simulators for target platforms

### Quick Setup

```bash
# Install globally
npm install -g mcp-xcode-server

# Run interactive setup
mcp-xcode-server setup
```

The setup wizard will:
- Configure the MCP server for Claude
- Optionally set up Xcode sync hooks
- Build necessary helper tools

### Manual Configuration

Add to `~/.claude.json` (global) or `.claude/settings.json` (project):

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

## Available Tools

### Building

- **`build_xcode`**: Build Xcode projects/workspaces (supports custom configurations)
- **`build_swift_package`**: Build Swift packages (Debug/Release only per SPM spec)
- **`run_xcode`**: Build and run on simulator/macOS
- **`run_swift_package`**: Execute Swift package executables

### Testing

- **`test_xcode`**: Run XCTest/Swift Testing suites
- **`test_swift_package`**: Test Swift packages
- Supports test filtering by class/method

### Project Information

- **`list_schemes`**: Get available Xcode schemes
- **`get_project_info`**: Comprehensive project details
- **`list_targets`**: List all build targets
- **`get_build_settings`**: Get scheme configuration

### Simulator Management

- **`list_simulators`**: Show available devices
- **`boot_simulator`**: Start a simulator
- **`shutdown_simulator`**: Stop a simulator
- **`view_simulator_screen`**: Capture screenshot

### App Management

- **`install_app`**: Install app on simulator
- **`uninstall_app`**: Remove app by bundle ID
- **`get_device_logs`**: Retrieve filtered device logs

### Distribution

- **`archive_project`**: Create .xcarchive
- **`export_ipa`**: Export IPA from archive

### Maintenance

- **`clean_build`**: Clean build artifacts/DerivedData
- **`manage_dependencies`**: Add/remove/update Swift packages

## Platform Support

| Platform | Simulator Required | Default Device | Min Version |
|----------|-------------------|----------------|-------------|
| iOS | Yes | iPhone 16 Pro | iOS 17+ |
| macOS | No | Host machine | macOS 14+ |
| tvOS | Yes | Apple TV | tvOS 17+ |
| watchOS | Yes | Apple Watch Series 10 | watchOS 10+ |
| visionOS | Yes | Apple Vision Pro | visionOS 1.0+ |

## Architecture

The server follows SOLID principles with a modular, class-based architecture:

### Core Structure
```
src/
├── index.ts           # MCP server entry point
├── tools/            # Self-contained tool implementations
├── utils/            # Shared utilities
│   ├── devices/      # Simulator management
│   ├── projects/     # Xcode/SPM operations
│   └── errors/       # Error parsing and handling
└── validation.ts     # Zod schemas for security
```

### Key Design Principles
- **Single Responsibility**: Each class has one clear purpose
- **Dependency Injection**: Testable, mockable components
- **Type Safety**: Full TypeScript with Zod validation
- **Security First**: Path validation, command injection protection
- **Error Recovery**: Graceful handling with helpful suggestions

## Logging

All operations are logged to `~/.mcp-xcode-server/logs/`:
- Daily folders (e.g., `2025-01-27/`)
- 7-day automatic retention
- Full xcodebuild/swift output preserved
- Symlinks to latest logs for easy access

## Development

```bash
# Build
npm run build

# Test
npm test              # All tests
npm run test:unit    # Unit tests only
npm run test:e2e     # End-to-end tests
npm run test:coverage # With coverage

# Development
npm run dev          # Build and run
```

## Contributing

Contributions welcome! Please ensure:
- Tests pass (`npm test`)
- Code follows SOLID principles
- New tools include tests
- Documentation updated

## License

MIT

## Support

- Report issues: [GitHub Issues](https://github.com/yourusername/mcp-xcode-server/issues)
- Documentation: [MCP Protocol](https://modelcontextprotocol.io)