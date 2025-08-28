import Testing
@testable import TestSwiftPackageSwiftTesting

struct ModernTests {
    @Test func testExample() async throws {
        // Simple test to verify the module can be imported and tested
        let spm = TestSwiftPackageSwiftTesting()
        #expect(spm.text == "Hello, TestSwiftPackageSwiftTesting!")
    }

    @Test func testFailingTest() async throws {
        // This test is designed to fail for MCP testing
        #expect(1 == 2, """
            Test MCP failing test reporting.
            This is a multi-line message to test
            how Swift Testing handles longer error descriptions.
            Line 4 of the message.
            Line 5 with special characters: @#$%^&*()
            """)
    }
    
    @Test func testAnotherFailure() async throws {
        // Another failing test to verify multiple failures are handled
        let result = 42
        #expect(result == 100, "Expected result to be 100 but got \(result)")
    }
}
