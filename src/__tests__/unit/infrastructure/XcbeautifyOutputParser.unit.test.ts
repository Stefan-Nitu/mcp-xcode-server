import { XcbeautifyOutputParser } from '../../../infrastructure/adapters/XcbeautifyOutputParser.js';
import { IOutputParser } from '../../../application/ports/OutputParserPorts.js';
import { BuildIssue } from '../../../domain/value-objects/BuildIssue.js';

describe('XcbeautifyOutputParser', () => {
  // Factory method for creating the SUT (System Under Test)
  function createSUT(): IOutputParser {
    return new XcbeautifyOutputParser();
  }

  describe('parseBuildOutput', () => {
    it('should parse single-line error with file information', () => {
      // Arrange
      const sut = createSUT();
      const output = `❌ /Users/project/App.swift:10:15: cannot find 'someVariable' in scope`;

      // Act
      const result = sut.parseBuildOutput(output);

      // Assert
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toEqual(
        BuildIssue.error(
          "cannot find 'someVariable' in scope",
          '/Users/project/App.swift',
          10,
          15
        )
      );
    });

    it('should parse single-line warning with file information', () => {
      // Arrange
      const sut = createSUT();
      const output = `⚠️ /Users/project/App.swift:20:10: variable 'unused' was never used`;

      // Act
      const result = sut.parseBuildOutput(output);

      // Assert
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toEqual(
        BuildIssue.warning(
          "variable 'unused' was never used",
          '/Users/project/App.swift',
          20,
          10
        )
      );
    });

    it('should parse multi-line error (with code context)', () => {
      // Arrange
      const sut = createSUT();
      const output = `❌ /Users/test/App.swift:10:5: cannot find 'someFunc' in scope
    someFunc()
    ^~~~~~~~`;

      // Act
      const result = sut.parseBuildOutput(output);

      // Assert - Should only extract the first line with the actual error
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toEqual(
        BuildIssue.error(
          "cannot find 'someFunc' in scope",
          '/Users/test/App.swift',
          10,
          5
        )
      );
    });

    it('should parse multi-line warning (with code context)', () => {
      // Arrange
      const sut = createSUT();
      const output = `⚠️ /Users/test/App.swift:15:10: variable 'unused' was never used
    let unused = 5
        ^~~~~~`;

      // Act
      const result = sut.parseBuildOutput(output);

      // Assert - Should only extract the first line with the actual warning
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toEqual(
        BuildIssue.warning(
          "variable 'unused' was never used",
          '/Users/test/App.swift',
          15,
          10
        )
      );
    });

    it('should parse error without file information', () => {
      // Arrange
      const sut = createSUT();
      const output = `❌ error: no such module 'Alamofire'`;

      // Act
      const result = sut.parseBuildOutput(output);

      // Assert
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toEqual(
        BuildIssue.error("no such module 'Alamofire'")
      );
    });

    it('should parse warning without file information', () => {
      // Arrange
      const sut = createSUT();
      const output = `⚠️ warning: deprecated API`;

      // Act
      const result = sut.parseBuildOutput(output);

      // Assert
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toEqual(
        BuildIssue.warning("deprecated API")
      );
    });

    it('should parse multiple issues', () => {
      // Arrange
      const sut = createSUT();
      const output = `❌ /Users/project/App.swift:10:15: cannot find type
⚠️ /Users/project/App.swift:20:10: unused variable
❌ error: build failed`;

      // Act
      const result = sut.parseBuildOutput(output);

      // Assert
      expect(result.issues).toHaveLength(3);
      expect(result.issues[0].isError()).toBe(true);
      expect(result.issues[1].isWarning()).toBe(true);
      expect(result.issues[2].isError()).toBe(true);
    });

    it('should handle ANSI color codes', () => {
      // Arrange
      const sut = createSUT();
      const output = `❌ /Users/test/App.swift:10:5: \x1b[31mcannot find 'someFunc' in scope\x1b[0m`;

      // Act
      const result = sut.parseBuildOutput(output);

      // Assert
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toBe("cannot find 'someFunc' in scope");
    });

    it('should deduplicate identical issues', () => {
      // Arrange
      const sut = createSUT();
      const output = `❌ /Users/project/App.swift:10:15: type error
❌ /Users/project/App.swift:10:15: type error
❌ /Users/project/App.swift:10:15: type error`;

      // Act
      const result = sut.parseBuildOutput(output);

      // Assert
      expect(result.issues).toHaveLength(1);
    });

    it('should return empty array when no issues', () => {
      // Arrange
      const sut = createSUT();
      const output = `Build succeeded
All tests passed
No issues found`;

      // Act
      const result = sut.parseBuildOutput(output);

      // Assert
      expect(result.issues).toEqual([]);
    });

    it('should skip xcbeautify header', () => {
      // Arrange
      const sut = createSUT();
      const output = `----- xcbeautify -----
Version: 2.30.1
----------------------
❌ /Users/project/App.swift:10:15: type error`;

      // Act
      const result = sut.parseBuildOutput(output);

      // Assert
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toBe('type error');
    });

    it('should handle mixed multi-line output', () => {
      // Arrange
      const sut = createSUT();
      const output = `❌ /Users/test/App.swift:10:5: cannot find 'someFunc' in scope
    someFunc()
    ^~~~~~~~
⚠️ /Users/test/App.swift:15:10: variable 'unused' was never used
    let unused = 5
        ^~~~~~
❌ error: build failed`;

      // Act
      const result = sut.parseBuildOutput(output);

      // Assert
      expect(result.issues).toHaveLength(3);
      expect(result.issues[0].message).toBe("cannot find 'someFunc' in scope");
      expect(result.issues[1].message).toBe("variable 'unused' was never used");
      expect(result.issues[2].message).toBe("build failed");
    });
  });
});