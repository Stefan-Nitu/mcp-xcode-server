import Testing
@testable import TestSwiftPackageSwiftTesting

@Test func example() async throws {
    // Simple test to verify the module can be imported and tested
    let spm = TestSwiftPackageSwiftTesting()
    #expect(spm.text == "Hello, TestSwiftPackageSwiftTesting!")
}

@Test func testFailingTest() async throws {
    // This test is designed to fail for MCP testing
    #expect(1 == 2, "Test MCP failing test reporting")
}
