import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ShellCommandExecutor, ExecFunction } from '../../../../infrastructure/adapters/ShellCommandExecutor.js';

/**
 * Unit tests for ShellCommandExecutor
 * 
 * Following testing philosophy:
 * - Test behavior, not implementation
 * - Use dependency injection for clean testing
 */
describe('ShellCommandExecutor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // Factory method for creating the SUT with mocked exec function
  function createSUT() {
    const mockExecAsync = jest.fn<ExecFunction>();
    const sut = new ShellCommandExecutor(mockExecAsync);
    return { sut, mockExecAsync };
  }
  
  describe('execute', () => {
    describe('when executing successful commands', () => {
      it('should return stdout and stderr with exitCode 0', async () => {
        // Arrange
        const { sut, mockExecAsync } = createSUT();
        const command = 'echo "hello world"';
        mockExecAsync.mockResolvedValue({ 
          stdout: 'hello world\n', 
          stderr: '' 
        });
        
        // Act
        const result = await sut.execute(command);
        
        // Assert
        expect(result).toEqual({
          stdout: 'hello world\n',
          stderr: '',
          exitCode: 0
        });
        expect(mockExecAsync).toHaveBeenCalledWith(command, expect.objectContaining({
          maxBuffer: 50 * 1024 * 1024,
          timeout: 300000,
          shell: '/bin/bash'
        }));
      });
      
      it('should handle large output', async () => {
        // Arrange
        const { sut, mockExecAsync } = createSUT();
        const command = 'cat large_file.txt';
        const largeOutput = 'x'.repeat(10 * 1024 * 1024); // 10MB
        mockExecAsync.mockResolvedValue({ 
          stdout: largeOutput, 
          stderr: '' 
        });
        
        // Act
        const result = await sut.execute(command);
        
        // Assert
        expect(result.stdout).toHaveLength(10 * 1024 * 1024);
        expect(result.exitCode).toBe(0);
      });
      
      it('should handle both stdout and stderr', async () => {
        // Arrange
        const { sut, mockExecAsync } = createSUT();
        const command = 'some-command';
        mockExecAsync.mockResolvedValue({ 
          stdout: 'standard output', 
          stderr: 'warning: something happened' 
        });
        
        // Act
        const result = await sut.execute(command);
        
        // Assert
        expect(result.stdout).toBe('standard output');
        expect(result.stderr).toBe('warning: something happened');
        expect(result.exitCode).toBe(0);
      });
    });
    
    describe('when executing failing commands', () => {
      it('should return output with non-zero exit code', async () => {
        // Arrange
        const { sut, mockExecAsync } = createSUT();
        const command = 'false';
        const error: any = new Error('Command failed');
        error.code = 1;
        error.stdout = '';
        error.stderr = 'command failed';
        mockExecAsync.mockRejectedValue(error);
        
        // Act
        const result = await sut.execute(command);
        
        // Assert
        expect(result).toEqual({
          stdout: '',
          stderr: 'command failed',
          exitCode: 1
        });
      });
      
      it('should capture output even on failure', async () => {
        // Arrange
        const { sut, mockExecAsync } = createSUT();
        const command = 'build-command';
        const error: any = new Error('Build failed');
        error.code = 65;
        error.stdout = 'Compiling...\nError at line 42';
        error.stderr = 'error: undefined symbol';
        mockExecAsync.mockRejectedValue(error);
        
        // Act
        const result = await sut.execute(command);
        
        // Assert
        expect(result.stdout).toContain('Compiling');
        expect(result.stderr).toContain('undefined symbol');
        expect(result.exitCode).toBe(65);
      });
      
      it('should handle missing error code', async () => {
        // Arrange
        const { sut, mockExecAsync } = createSUT();
        const command = 'unknown-command';
        const error: any = new Error('Command not found');
        // No error.code set
        error.stdout = '';
        error.stderr = 'command not found';
        mockExecAsync.mockRejectedValue(error);
        
        // Act
        const result = await sut.execute(command);
        
        // Assert
        expect(result.exitCode).toBe(1); // Default to 1 when no code
      });
    });
    
    describe('with custom options', () => {
      it('should pass maxBuffer option', async () => {
        // Arrange
        const { sut, mockExecAsync } = createSUT();
        const command = 'echo test';
        const options = { maxBuffer: 100 * 1024 * 1024 }; // 100MB
        mockExecAsync.mockResolvedValue({ stdout: 'test', stderr: '' });
        
        // Act
        await sut.execute(command, options);
        
        // Assert
        expect(mockExecAsync).toHaveBeenCalledWith(command, expect.objectContaining({
          maxBuffer: 100 * 1024 * 1024
        }));
      });
      
      it('should pass timeout option', async () => {
        // Arrange
        const { sut, mockExecAsync } = createSUT();
        const command = 'long-running-command';
        const options = { timeout: 600000 }; // 10 minutes
        mockExecAsync.mockResolvedValue({ stdout: 'done', stderr: '' });
        
        // Act
        await sut.execute(command, options);
        
        // Assert
        expect(mockExecAsync).toHaveBeenCalledWith(command, expect.objectContaining({
          timeout: 600000
        }));
      });
      
      it('should pass shell option', async () => {
        // Arrange
        const { sut, mockExecAsync } = createSUT();
        const command = 'echo $SHELL';
        const options = { shell: '/bin/zsh' };
        mockExecAsync.mockResolvedValue({ stdout: '/bin/zsh', stderr: '' });
        
        // Act
        await sut.execute(command, options);
        
        // Assert
        expect(mockExecAsync).toHaveBeenCalledWith(command, expect.objectContaining({
          shell: '/bin/zsh'
        }));
      });
      
      it('should use default options when not provided', async () => {
        // Arrange
        const { sut, mockExecAsync } = createSUT();
        const command = 'echo test';
        mockExecAsync.mockResolvedValue({ stdout: 'test', stderr: '' });
        
        // Act
        await sut.execute(command);
        
        // Assert
        expect(mockExecAsync).toHaveBeenCalledWith(command, {
          maxBuffer: 50 * 1024 * 1024,
          timeout: 300000,
          shell: '/bin/bash'
        });
      });
    });
  });
});