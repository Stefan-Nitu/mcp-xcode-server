import { parseXcbeautifyOutput } from '../../utils/errors/xcbeautify-parser';

describe('XcbeautifyParser', () => {
  describe('parseXcbeautifyOutput', () => {
    it('should parse errors marked with ❌', () => {
      const inputs = [
        '❌ /path/to/file.swift:10:5: error: cannot find \'someVariable\' in scope',
        '❌ ld: symbol(s) not found for architecture x86_64',
        '❌ Code Signing Error: No certificate matching found',
        '❌ error: no such module \'UnknownModule\''
      ];

      for (const input of inputs) {
        const result = parseXcbeautifyOutput(input);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].type).toBe('error');
        expect(result.buildSucceeded).toBe(false);
      }
    });

    it('should parse warnings marked with ⚠️', () => {
      const inputs = [
        '⚠️ /path/to/file.swift:10:5: warning: variable \'unused\' was never used',
        '⚠️ warning: deprecated API usage'
      ];

      for (const input of inputs) {
        const result = parseXcbeautifyOutput(input);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].type).toBe('warning');
        expect(result.buildSucceeded).toBe(true); // Warnings don't fail the build
      }
    });

    it('should parse test results with ✔ and ✖', () => {
      // Test passes
      const passInput = '✔ testExample (0.123 seconds)';
      const passResult = parseXcbeautifyOutput(passInput);
      expect(passResult.tests).toHaveLength(1);
      expect(passResult.tests[0].passed).toBe(true);
      expect(passResult.errors).toHaveLength(0);

      // Test failures
      const failInput = '✖ testUserCreation, XCTAssertEqual failed';
      const failResult = parseXcbeautifyOutput(failInput);
      expect(failResult.tests).toHaveLength(1);
      expect(failResult.tests[0].passed).toBe(false);
      expect(failResult.errors).toHaveLength(0);
    });
    it('should parse errors with file location', () => {
      const input = '❌ /path/to/file.swift:10:5: error: cannot find \'someVariable\' in scope';
      const result = parseXcbeautifyOutput(input);
      
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        type: 'error',
        file: '/path/to/file.swift',
        line: 10,
        column: 5,
        message: 'error: cannot find \'someVariable\' in scope'
      });
    });

    it('should parse warnings', () => {
      const input = '⚠️ /path/to/file.swift:10:5: warning: variable \'unused\' was never used';
      const result = parseXcbeautifyOutput(input);
      
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatchObject({
        type: 'warning',
        file: '/path/to/file.swift',
        line: 10,
        column: 5,
        message: 'warning: variable \'unused\' was never used'
      });
    });

    it('should parse test passes', () => {
      const input = '✔ testExample (0.123 seconds)';
      const result = parseXcbeautifyOutput(input);
      
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0]).toMatchObject({
        name: 'testExample',
        passed: true,
        duration: 0.123
      });
    });

    it('should parse test failures', () => {
      const input = '✖ testFailure, assertion failed';
      const result = parseXcbeautifyOutput(input);
      
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0]).toMatchObject({
        name: 'testFailure',
        passed: false,
        failureReason: 'assertion failed'
      });
    });

    it('should detect build failure', () => {
      const input = `
❌ error: cannot find 'foo' in scope
** BUILD FAILED **
      `.trim();
      
      const result = parseXcbeautifyOutput(input);
      expect(result.buildSucceeded).toBe(false);
    });

    it('should detect test failure', () => {
      const input = `
✖ testExample
** TEST FAILED **
      `.trim();
      
      const result = parseXcbeautifyOutput(input);
      expect(result.testsPassed).toBe(false);
    });

    it('should parse test summary', () => {
      const input = 'Executed 10 tests, with 2 failures';
      const result = parseXcbeautifyOutput(input);
      
      expect(result.totalTests).toBe(10);
      expect(result.failedTests).toBe(2);
      expect(result.testsPassed).toBe(false);
    });
  });
});