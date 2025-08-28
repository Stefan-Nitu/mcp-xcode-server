import XCTest
@testable import TestSwiftPackageXCTest

final class LegacyTests: XCTestCase {
    func testExample() throws {
        let spm = TestSwiftPackageXCTest()
        XCTAssertEqual(spm.text, "Hello, TestSwiftPackageXCTest!")
    }
    
    func testFailingTest() async throws {
        // This test is designed to fail for MCP testing
        XCTFail("Test MCP failing test reporting")
    }
}
