//
//  TestProjectSwiftTestingTests.swift
//  TestProjectSwiftTestingTests
//
//  Created by Stefan Dragos Nitu on 17/08/2025.
//

import Testing

struct TestProjectSwiftTestingTests {

    @Test func example() async throws {
        // Write your test here and use APIs like `#expect(...)` to check expected conditions.
        #expect(true)
    }
    
    @Test func testFailingTest() async throws {
        // This test intentionally fails to test failure reporting
        #expect(false, "This test is designed to fail for testing MCP failure reporting")
    }
    
    @Test func testAnotherFailure() async throws {
        // Another failing test to verify multiple failures are handled
        let result = 42
        #expect(result == 100, "Expected result to be 100 but got \(result)")
    }

}
