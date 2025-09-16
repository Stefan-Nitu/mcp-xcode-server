import { BuildIssuesStrategy } from '../../formatters/strategies/BuildIssuesStrategy.js';
import { BuildIssue } from '../../../features/build/domain/BuildIssue.js';

describe('BuildIssuesStrategy', () => {
  function createSUT(): BuildIssuesStrategy {
    return new BuildIssuesStrategy();
  }

  function createErrorWithIssues(issues: BuildIssue[], message?: string) {
    return { issues, message };
  }

  describe('canFormat', () => {
    it('should return true for error with BuildIssue array', () => {
      const sut = createSUT();
      const error = createErrorWithIssues([
        BuildIssue.error('Test error')
      ]);
      
      const result = sut.canFormat(error);
      
      expect(result).toBe(true);
    });

    it('should return true when at least one issue is BuildIssue instance', () => {
      const sut = createSUT();
      const error = {
        issues: [
          BuildIssue.error('Real issue'),
          { message: 'Not a BuildIssue' }
        ]
      };
      
      const result = sut.canFormat(error);
      
      expect(result).toBe(true);
    });

    it('should return false for error without issues property', () => {
      const sut = createSUT();
      const error = { message: 'Plain error' };
      
      const result = sut.canFormat(error);
      
      expect(result).toBe(false);
    });

    it('should return false when issues is not an array', () => {
      const sut = createSUT();
      const error = { issues: 'not an array' };
      
      const result = sut.canFormat(error);
      
      expect(result).toBe(false);
    });

    it('should return false when issues array is empty', () => {
      const sut = createSUT();
      const error = { issues: [] };
      
      const result = sut.canFormat(error);
      
      expect(result).toBe(false);
    });

    it('should return false when no issues are BuildIssue instances', () => {
      const sut = createSUT();
      const error = {
        issues: [
          { message: 'Plain object 1' },
          { message: 'Plain object 2' }
        ]
      };
      
      const result = sut.canFormat(error);
      
      expect(result).toBe(false);
    });
  });

  describe('format', () => {
    describe('when formatting errors only', () => {
      it('should format single error correctly', () => {
        const sut = createSUT();
        const error = createErrorWithIssues([
          BuildIssue.error('Cannot find module', 'src/main.ts', 10, 5)
        ]);
        
        const result = sut.format(error);
        
        const expected = 
`❌ Errors (1):
  • src/main.ts:10:5: Cannot find module`;
        
        expect(result).toBe(expected);
      });

      it('should format multiple errors with file information', () => {
        const sut = createSUT();
        const error = createErrorWithIssues([
          BuildIssue.error('Cannot find module', 'src/main.ts', 10, 5),
          BuildIssue.error('Type mismatch', 'src/utils.ts', 20, 3)
        ]);
        
        const result = sut.format(error);
        
        const expected = 
`❌ Errors (2):
  • src/main.ts:10:5: Cannot find module
  • src/utils.ts:20:3: Type mismatch`;
        
        expect(result).toBe(expected);
      });

      it('should limit to 5 errors and show count for more', () => {
        const sut = createSUT();
        const issues = Array.from({ length: 10 }, (_, i) => 
          BuildIssue.error(`Error ${i + 1}`, `file${i}.ts`)
        );
        const error = createErrorWithIssues(issues);
        
        const result = sut.format(error);
        
        expect(result).toContain('❌ Errors (10):');
        expect(result).toContain('file0.ts: Error 1');
        expect(result).toContain('file4.ts: Error 5');
        expect(result).not.toContain('file5.ts: Error 6');
        expect(result).toContain('... and 5 more errors');
      });

      it('should handle errors without file information', () => {
        const sut = createSUT();
        const error = createErrorWithIssues([
          BuildIssue.error('General build error'),
          BuildIssue.error('Another error without file')
        ]);
        
        const result = sut.format(error);
        
        const expected = 
`❌ Errors (2):
  • General build error
  • Another error without file`;
        
        expect(result).toBe(expected);
      });
    });

    describe('when formatting warnings only', () => {
      it('should format single warning correctly', () => {
        const sut = createSUT();
        const error = createErrorWithIssues([
          BuildIssue.warning('Deprecated API usage', 'src/legacy.ts', 15)
        ]);
        
        const result = sut.format(error);
        
        const expected = 
`⚠️ Warnings (1):
  • src/legacy.ts:15: Deprecated API usage`;
        
        expect(result).toBe(expected);
      });

      it('should limit to 3 warnings and show count for more', () => {
        const sut = createSUT();
        const issues = Array.from({ length: 6 }, (_, i) => 
          BuildIssue.warning(`Warning ${i + 1}`, `file${i}.ts`)
        );
        const error = createErrorWithIssues(issues);
        
        const result = sut.format(error);
        
        expect(result).toContain('⚠️ Warnings (6):');
        expect(result).toContain('file0.ts: Warning 1');
        expect(result).toContain('file2.ts: Warning 3');
        expect(result).not.toContain('file3.ts: Warning 4');
        expect(result).toContain('... and 3 more warnings');
      });
    });

    describe('when formatting mixed errors and warnings', () => {
      it('should show both sections separated by blank line', () => {
        const sut = createSUT();
        const error = createErrorWithIssues([
          BuildIssue.error('Error message', 'error.ts'),
          BuildIssue.warning('Warning message', 'warning.ts')
        ]);
        
        const result = sut.format(error);
        
        const expected = 
`❌ Errors (1):
  • error.ts: Error message

⚠️ Warnings (1):
  • warning.ts: Warning message`;
        
        expect(result).toBe(expected);
      });

      it('should handle many mixed issues correctly', () => {
        const sut = createSUT();
        const issues = [
          ...Array.from({ length: 7 }, (_, i) => 
            BuildIssue.error(`Error ${i + 1}`, `error${i}.ts`)
          ),
          ...Array.from({ length: 5 }, (_, i) => 
            BuildIssue.warning(`Warning ${i + 1}`, `warn${i}.ts`)
          )
        ];
        const error = createErrorWithIssues(issues);
        
        const result = sut.format(error);
        
        expect(result).toContain('❌ Errors (7):');
        expect(result).toContain('... and 2 more errors');
        expect(result).toContain('⚠️ Warnings (5):');
        expect(result).toContain('... and 2 more warnings');
        expect(result.split('\n\n')).toHaveLength(2); // Two sections
      });
    });

    describe('when handling edge cases', () => {
      it('should return fallback message when no issues', () => {
        const sut = createSUT();
        const error = createErrorWithIssues([]);
        
        const result = sut.format(error);
        
        expect(result).toBe('Build failed');
      });

      it('should use provided message as fallback when no issues', () => {
        const sut = createSUT();
        const error = createErrorWithIssues([], 'Custom build failure');
        
        const result = sut.format(error);
        
        expect(result).toBe('Custom build failure');
      });

      it('should handle mix of BuildIssue and non-BuildIssue objects', () => {
        const sut = createSUT();
        const error = {
          issues: [
            BuildIssue.error('Real error'),
            { type: 'error', message: 'Not a BuildIssue' }, // Will be filtered out
            BuildIssue.warning('Real warning')
          ]
        };
        
        const result = sut.format(error);
        
        // Only real BuildIssues should be processed
        expect(result).toContain('❌ Errors (1):');
        expect(result).toContain('Real error');
        expect(result).toContain('⚠️ Warnings (1):');
        expect(result).toContain('Real warning');
      });

      it('should handle issues with unknown types gracefully', () => {
        const sut = createSUT();
        const issues = [
          BuildIssue.error('Error'),
          BuildIssue.warning('Warning'),
          Object.assign(BuildIssue.error('Info'), { type: 'info' as any }) // Unknown type
        ];
        const error = createErrorWithIssues(issues);
        
        const result = sut.format(error);
        
        // Unknown type should be ignored
        expect(result).toContain('❌ Errors (1):');
        expect(result).toContain('⚠️ Warnings (1):');
        expect(result).not.toContain('info');
      });
    });
  });
});