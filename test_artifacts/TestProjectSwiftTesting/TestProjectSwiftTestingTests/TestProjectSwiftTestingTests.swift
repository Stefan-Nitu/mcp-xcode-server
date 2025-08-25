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

}
