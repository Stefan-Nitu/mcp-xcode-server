import { describe, it, expect, jest } from '@jest/globals';
import { DependencyChecker } from '../../../../infrastructure/services/DependencyChecker.js';
import { ICommandExecutor } from '../../../../application/ports/CommandPorts.js';

describe('DependencyChecker', () => {
  function createSUT() {
    const mockExecute = jest.fn<ICommandExecutor['execute']>();
    const mockExecutor: ICommandExecutor = { execute: mockExecute };
    const sut = new DependencyChecker(mockExecutor);
    return { sut, mockExecute };
  }

  describe('check', () => {
    it('should return empty array when all dependencies are installed', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();

      // All which commands succeed
      mockExecute.mockResolvedValue({
        stdout: '/usr/bin/xcodebuild',
        stderr: '',
        exitCode: 0
      });

      // Act
      const result = await sut.check(['xcodebuild', 'xcbeautify']);

      // Assert - behavior: no missing dependencies
      expect(result).toEqual([]);
    });

    it('should return missing dependencies with install commands', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();

      // xcbeautify not found
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: 'xcbeautify not found',
        exitCode: 1
      });

      // Act
      const result = await sut.check(['xcbeautify']);

      // Assert - behavior: returns missing dependency with install command
      expect(result).toEqual([
        {
          name: 'xcbeautify',
          installCommand: 'brew install xcbeautify'
        }
      ]);
    });

    it('should handle mix of installed and missing dependencies', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();

      // xcodebuild found, xcbeautify not found
      mockExecute
        .mockResolvedValueOnce({
          stdout: '/usr/bin/xcodebuild',
          stderr: '',
          exitCode: 0
        })
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'xcbeautify not found',
          exitCode: 1
        });

      // Act
      const result = await sut.check(['xcodebuild', 'xcbeautify']);

      // Assert - behavior: only missing dependencies returned
      expect(result).toEqual([
        {
          name: 'xcbeautify',
          installCommand: 'brew install xcbeautify'
        }
      ]);
    });

    it('should handle unknown dependencies', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();

      // Unknown tool not found
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: 'unknowntool not found',
        exitCode: 1
      });

      // Act
      const result = await sut.check(['unknowntool']);

      // Assert - behavior: returns missing dependency without install command
      expect(result).toEqual([
        {
          name: 'unknowntool'
        }
      ]);
    });

    it('should provide appropriate install commands for known tools', async () => {
      // Arrange
      const { sut, mockExecute } = createSUT();

      // All tools missing
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: 'not found',
        exitCode: 1
      });

      // Act
      const result = await sut.check(['xcodebuild', 'xcrun', 'xcbeautify']);

      // Assert - behavior: each tool has appropriate install command
      expect(result).toContainEqual({
        name: 'xcodebuild',
        installCommand: 'Install Xcode from the App Store'
      });
      expect(result).toContainEqual({
        name: 'xcrun',
        installCommand: 'Install Xcode Command Line Tools: xcode-select --install'
      });
      expect(result).toContainEqual({
        name: 'xcbeautify',
        installCommand: 'brew install xcbeautify'
      });
    });
  });
});