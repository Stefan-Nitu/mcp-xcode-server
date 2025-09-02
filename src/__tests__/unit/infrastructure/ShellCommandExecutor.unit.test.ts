import { ShellCommandExecutor } from '../../../infrastructure/adapters/ShellCommandExecutor.js';
import { execAsync } from '../../../utils.js';
import { ICommandExecutor, ExecutionResult } from '../../../application/ports/BuildPorts.js';

// Mock only external boundaries
jest.mock('../../../utils.js');

describe('ShellCommandExecutor', () => {
  // Factory method for creating the SUT with mocked dependencies
  function createSUT() {
    const mockExecAsync = execAsync as jest.MockedFunction<typeof execAsync>;
    const sut = new ShellCommandExecutor();
    return { sut, mockExecAsync };
  }
  
  // Factory methods for test data
  function createSuccessResult(stdout = 'success output', stderr = ''): { stdout: string; stderr: string } {
    return { stdout, stderr };
  }
  
  function createCommandError(code = 1, stdout = '', stderr = 'error message'): any {
    const error: any = new Error('Command failed');
    error.code = code;
    error.stdout = stdout;
    error.stderr = stderr;
    return error;
  }
  
  describe('execute', () => {
    describe('when executing successful commands', () => {
      it('should return stdout and stderr with exitCode 0', async () => {
        // Arrange
        const { sut, mockExecAsync } = createSUT();
        const command = 'echo "hello world"';
        const expectedResult = createSuccessResult('hello world\n', '');
        mockExecAsync.mockResolvedValue(expectedResult);
        
        // Act
        const result = await sut.execute(command);
        
        // Assert - focus on behavior, not implementation
        expect(result).toEqual({
          stdout: 'hello world\n',
          stderr: '',
          exitCode: 0
        });
      });
    });
    
    describe('when command fails with exit code', () => {
      it('should return output with non-zero exitCode', async () => {
        // Arrange
        const { sut, mockExecAsync } = createSUT();
        const command = 'exit 1';
        const error = createCommandError(1, 'partial output', 'error message');
        mockExecAsync.mockRejectedValue(error);
        
        // Act
        const result = await sut.execute(command);
        
        // Assert
        expect(result).toEqual({
          stdout: 'partial output',
          stderr: 'error message',
          exitCode: 1
        });
      });
      
      it('should handle missing error properties gracefully', async () => {
        // Arrange
        const { sut, mockExecAsync } = createSUT();
        const command = 'bad-command';
        const error = new Error('Command not found');
        mockExecAsync.mockRejectedValue(error);
        
        // Act
        const result = await sut.execute(command);
        
        // Assert
        expect(result).toEqual({
          stdout: '',
          stderr: '',
          exitCode: 1
        });
      });
    });
    
    describe('when using custom execution options', () => {
      it('should respect custom maxBuffer', async () => {
        // Arrange
        const { sut, mockExecAsync } = createSUT();
        const command = 'echo "test"';
        const customMaxBuffer = 100 * 1024 * 1024;
        mockExecAsync.mockResolvedValue(createSuccessResult('test\n'));
        
        // Act
        await sut.execute(command, { maxBuffer: customMaxBuffer });
        
        // Assert
        expect(mockExecAsync).toHaveBeenCalledWith(command, {
          maxBuffer: customMaxBuffer,
          timeout: 300000,
          shell: '/bin/bash'
        });
      });
      
      it('should respect custom timeout', async () => {
        // Arrange
        const { sut, mockExecAsync } = createSUT();
        const command = 'long-running-command';
        const customTimeout = 600000;
        mockExecAsync.mockResolvedValue(createSuccessResult('done'));
        
        // Act
        await sut.execute(command, { timeout: customTimeout });
        
        // Assert
        expect(mockExecAsync).toHaveBeenCalledWith(command, {
          maxBuffer: 50 * 1024 * 1024,
          timeout: customTimeout,
          shell: '/bin/bash'
        });
      });
      
      it('should respect custom shell', async () => {
        // Arrange
        const { sut, mockExecAsync } = createSUT();
        const command = 'zsh-specific-command';
        const customShell = '/bin/zsh';
        mockExecAsync.mockResolvedValue(createSuccessResult('zsh output'));
        
        // Act
        await sut.execute(command, { shell: customShell });
        
        // Assert
        expect(mockExecAsync).toHaveBeenCalledWith(command, {
          maxBuffer: 50 * 1024 * 1024,
          timeout: 300000,
          shell: customShell
        });
      });
      
      it('should handle multiple custom options', async () => {
        // Arrange
        const { sut, mockExecAsync } = createSUT();
        const command = 'complex-command';
        const options = {
          maxBuffer: 200 * 1024 * 1024,
          timeout: 900000,
          shell: '/bin/zsh'
        };
        mockExecAsync.mockResolvedValue(createSuccessResult('complex output', 'warnings'));
        
        // Act
        const result = await sut.execute(command, options);
        
        // Assert
        expect(result).toEqual({
          stdout: 'complex output',
          stderr: 'warnings',
          exitCode: 0
        });
        expect(mockExecAsync).toHaveBeenCalledWith(command, options);
      });
    });
  });
});