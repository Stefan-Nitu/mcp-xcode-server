import Testing
@testable import TestSPM

@Test func example() async throws {
    // Simple test to verify the module can be imported and tested
    let spm = TestSPM()
    #expect(spm.text == "Hello, TestSPM!")
}

@Test func testFailingTest() async throws {
    // This test is designed to fail for MCP testing
    #expect(1 == 2, "Test MCP failing test reporting")
}
