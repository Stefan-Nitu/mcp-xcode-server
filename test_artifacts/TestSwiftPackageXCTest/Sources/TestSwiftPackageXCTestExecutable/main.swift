import Foundation

// Simple executable for testing
print("TestSwiftPackageXCTestExecutable Executable Running")
print("Arguments: \(CommandLine.arguments)")
print("Current Date: \(Date())")

// Test argument handling
if CommandLine.arguments.count > 1 {
    print("Received \(CommandLine.arguments.count - 1) arguments:")
    for (index, arg) in CommandLine.arguments.dropFirst().enumerated() {
        print("  Arg \(index + 1): \(arg)")
    }
}

// Test exit codes
if CommandLine.arguments.contains("--fail") {
    print("Error: Requested failure via --fail flag")
    exit(1)
}

print("Execution completed successfully")
