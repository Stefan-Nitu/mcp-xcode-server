import Testing
@testable import TestSPM

@Test func example() async throws {
    // Simple test to verify the module can be imported and tested
    let spm = TestSPM()
    #expect(spm.text == "Hello, TestSPM!")
}
