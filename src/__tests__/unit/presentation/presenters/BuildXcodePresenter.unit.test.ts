import { describe, it, expect } from '@jest/globals';
import { BuildXcodePresenter } from '../../../../presentation/presenters/BuildXcodePresenter.js';
import { BuildResult } from '../../../../domain/entities/BuildResult.js';
import { BuildIssue } from '../../../../domain/value-objects/BuildIssue.js';
import { Platform } from '../../../../domain/value-objects/Platform.js';

describe('BuildXcodePresenter', () => {
  // Factory method for creating SUT - DAMP approach
  function createSUT(): BuildXcodePresenter {
    return new BuildXcodePresenter();
  }
  
  // Test data factories
  function createTestMetadata(overrides = {}) {
    return {
      scheme: 'MyApp',
      platform: Platform.iOS,
      configuration: 'Debug',
      showWarningDetails: false,
      ...overrides
    };
  }
  
  function createSuccessResult(appPath?: string, logPath?: string): BuildResult {
    return BuildResult.succeeded('Build succeeded', appPath, logPath);
  }
  
  function createFailureResult(issues: BuildIssue[] = [], logPath?: string): BuildResult {
    return BuildResult.failed('Build failed', issues, 1, logPath);
  }
  
  describe('when presenting successful build', () => {
    it('should show success message with scheme', () => {
      const presenter = createSUT();
      const result = createSuccessResult();
      const metadata = createTestMetadata();
      
      const response = presenter.present(result, metadata);
      
      expect(response.content[0].type).toBe('text');
      expect(response.content[0].text).toContain('✅ Build succeeded: MyApp');
    });
    
    it('should show warning count for successful build with warnings', () => {
      const presenter = createSUT();
      // Create a successful build result with warnings
      const warnings = [
        BuildIssue.warning('Deprecated API', 'api.swift', 5),
        BuildIssue.warning('Unused variable', 'vars.swift', 15)
      ];
      const result = BuildResult.succeeded('Build succeeded', '/path/to/app.app', undefined, warnings);
      const metadata = createTestMetadata();
      
      const response = presenter.present(result, metadata);
      
      expect(response.content[0].text).toContain('✅ Build succeeded: MyApp');
      expect(response.content[0].text).toContain('Warnings: 2');
      expect(response.content[0].text).not.toContain('Deprecated API'); // Details not shown by default
    });
    
    it('should show warning details for successful build when requested', () => {
      const presenter = createSUT();
      const warnings = [
        BuildIssue.warning('Deprecated API', 'api.swift', 5),
        BuildIssue.warning('Unused variable', 'vars.swift', 15)
      ];
      const result = BuildResult.succeeded('Build succeeded', '/path/to/app.app', undefined, warnings);
      const metadata = createTestMetadata({ showWarningDetails: true });
      
      const response = presenter.present(result, metadata);
      
      expect(response.content[0].text).toContain('✅ Build succeeded: MyApp');
      expect(response.content[0].text).toContain('Warnings: 2');
      expect(response.content[0].text).toContain('⚠️  Warnings:');
      expect(response.content[0].text).toContain('Deprecated API');
      expect(response.content[0].text).toContain('Unused variable');
    });
    
    it('should include platform and configuration', () => {
      const presenter = createSUT();
      const result = createSuccessResult();
      const metadata = { scheme: 'MyApp', platform: Platform.iOS, configuration: 'Release' };
      
      const response = presenter.present(result, metadata);
      
      expect(response.content[0].text).toContain('Platform: iOS');
      expect(response.content[0].text).toContain('Configuration: Release');
    });
    
    it('should show app path when available', () => {
      const presenter = createSUT();
      const appPath = '/path/to/MyApp.app';
      const result = createSuccessResult(appPath);
      const metadata = createTestMetadata();
      
      const response = presenter.present(result, metadata);
      
      expect(response.content[0].text).toContain(`App path: ${appPath}`);
    });
    
    it('should show N/A when app path is not available', () => {
      const presenter = createSUT();
      const result = createSuccessResult(undefined);
      const metadata = createTestMetadata();
      
      const response = presenter.present(result, metadata);
      
      expect(response.content[0].text).toContain('App path: N/A');
    });
    
    it('should show log path when available', () => {
      const presenter = createSUT();
      const logPath = '/var/logs/build.log';
      const result = createSuccessResult(undefined, logPath);
      const metadata = createTestMetadata();
      
      const response = presenter.present(result, metadata);
      
      expect(response.content[0].text).toContain('📁 Full logs saved to: /var/logs/build.log');
    });
  });
  
  describe('when presenting failed build with errors', () => {
    it('should show failure message with scheme', () => {
      const presenter = createSUT();
      const result = createFailureResult();
      const metadata = createTestMetadata();
      
      const response = presenter.present(result, metadata);
      
      expect(response.content[0].text).toContain('❌ Build failed: MyApp');
      expect(response.content[0].text).toContain('Platform: iOS');
      expect(response.content[0].text).toContain('Configuration: Debug');
    });
    
    it('should show all errors when there are less than 50', () => {
      const presenter = createSUT();
      const errors = Array.from({ length: 30 }, (_, i) => 
        BuildIssue.error(`Error ${i + 1}`, `file${i}.swift`, (i + 1) * 10)
      );
      const result = createFailureResult(errors);
      const metadata = createTestMetadata();
      
      const response = presenter.present(result, metadata);
      const text = response.content[0].text;
      
      expect(text).toContain('❌ Errors (30):');
      expect(text).toContain('Error 1');
      expect(text).toContain('Error 30');
      expect(text).not.toContain('... and');
    });
    
    it('should limit to 50 errors when there are more', () => {
      const presenter = createSUT();
      const errors = Array.from({ length: 75 }, (_, i) => 
        BuildIssue.error(`Error ${i + 1}`, `file${i}.swift`, (i + 1) * 10)
      );
      const result = createFailureResult(errors);
      const metadata = createTestMetadata();
      
      const response = presenter.present(result, metadata);
      const text = response.content[0].text;
      
      expect(text).toContain('❌ Errors (75):');
      expect(text).toContain('Error 1');
      expect(text).toContain('Error 50');
      expect(text).not.toContain('Error 51');
      expect(text).toContain('... and 25 more errors');
    });
    
    it('should handle exactly 50 errors without truncation message', () => {
      const presenter = createSUT();
      const errors = Array.from({ length: 50 }, (_, i) => 
        BuildIssue.error(`Error ${i + 1}`, `file${i}.swift`)
      );
      const result = createFailureResult(errors);
      const metadata = createTestMetadata();
      
      const response = presenter.present(result, metadata);
      const text = response.content[0].text;
      
      expect(text).toContain('❌ Errors (50):');
      expect(text).toContain('Error 50');
      expect(text).not.toContain('... and');
    });
  });
  
  describe('when handling warnings', () => {
    it('should show warning count but not details by default', () => {
      const presenter = createSUT();
      const warnings = [
        BuildIssue.warning('Deprecated API', 'api.swift', 5),
        BuildIssue.warning('Unused variable', 'vars.swift', 15)
      ];
      const result = createFailureResult(warnings);
      const metadata = createTestMetadata(); // showWarningDetails defaults to false
      
      const response = presenter.present(result, metadata);
      const text = response.content[0].text;
      
      expect(text).toContain('⚠️ Warnings: 2');
      expect(text).not.toContain('Deprecated API');
      expect(text).not.toContain('Unused variable');
    });
    
    it('should show warning details when showWarningDetails is true', () => {
      const presenter = createSUT();
      const warnings = [
        BuildIssue.warning('Deprecated API', 'api.swift', 5),
        BuildIssue.warning('Unused variable', 'vars.swift', 15)
      ];
      const result = createFailureResult(warnings);
      const metadata = createTestMetadata({ showWarningDetails: true });
      
      const response = presenter.present(result, metadata);
      const text = response.content[0].text;
      
      expect(text).toContain('⚠️ Warnings (2):');
      expect(text).toContain('Deprecated API');
      expect(text).toContain('Unused variable');
    });
    
    it('should show only count when showWarningDetails is explicitly false', () => {
      const presenter = createSUT();
      const warnings = [BuildIssue.warning('Deprecated API')];
      const result = createFailureResult(warnings);
      const metadata = { scheme: 'MyApp', platform: Platform.iOS, configuration: 'Debug', showWarningDetails: false };
      
      const response = presenter.present(result, metadata);
      const text = response.content[0].text;
      
      expect(text).toContain('⚠️ Warnings: 1');
      expect(text).not.toContain('Deprecated API');
    });
    
    it('should limit warnings to 20 when showing details', () => {
      const presenter = createSUT();
      const warnings = Array.from({ length: 30 }, (_, i) =>
        BuildIssue.warning(`Warning ${i + 1}`, `file${i}.swift`)
      );
      const result = createFailureResult(warnings);
      const metadata = createTestMetadata({ showWarningDetails: true });
      
      const response = presenter.present(result, metadata);
      const text = response.content[0].text;
      
      expect(text).toContain('⚠️ Warnings (30):');
      expect(text).toContain('Warning 1');
      expect(text).toContain('Warning 20');
      expect(text).not.toContain('Warning 21');
      expect(text).toContain('... and 10 more warnings');
    });
    
    it('should show errors with warning count or details based on flag', () => {
      const presenter = createSUT();
      const issues = [
        BuildIssue.error('Compile error', 'main.swift'),
        BuildIssue.warning('Unused import', 'imports.swift')
      ];
      const result = createFailureResult(issues);
      
      // With warning details
      const responseWithDetails = presenter.present(result, createTestMetadata({ showWarningDetails: true }));
      expect(responseWithDetails.content[0].text).toContain('❌ Errors (1):');
      expect(responseWithDetails.content[0].text).toContain('Compile error');
      expect(responseWithDetails.content[0].text).toContain('⚠️ Warnings (1):');
      expect(responseWithDetails.content[0].text).toContain('Unused import');
      
      // Without warning details (just count)
      const responseWithoutDetails = presenter.present(result, createTestMetadata({ showWarningDetails: false }));
      expect(responseWithoutDetails.content[0].text).toContain('❌ Errors (1):');
      expect(responseWithoutDetails.content[0].text).toContain('Compile error');
      expect(responseWithoutDetails.content[0].text).toContain('⚠️ Warnings: 1');
      expect(responseWithoutDetails.content[0].text).not.toContain('Unused import');
    });
  });
  
  describe('when formatting issues', () => {
    it('should use toString method when available', () => {
      const presenter = createSUT();
      const issue = BuildIssue.error('Test error', 'test.swift', 10, 5);
      const result = createFailureResult([issue]);
      const metadata = createTestMetadata();
      
      const response = presenter.present(result, metadata);
      
      // BuildIssue.toString() formats as "file:line:column: message"
      expect(response.content[0].text).toContain('test.swift:10:5: Test error');
    });
    
    it('should handle issues without file location', () => {
      const presenter = createSUT();
      const issue = BuildIssue.error('General error');
      const result = createFailureResult([issue]);
      const metadata = createTestMetadata();
      
      const response = presenter.present(result, metadata);
      
      expect(response.content[0].text).toContain('General error');
    });
  });
  
  describe('when presenting generic errors', () => {
    it('should format error with message', () => {
      const presenter = createSUT();
      const error = new Error('Something went wrong');
      
      const response = presenter.presentError(error);
      
      expect(response.content[0].type).toBe('text');
      expect(response.content[0].text).toBe('❌ Something went wrong');
    });
  });
  
  describe('MCP response format', () => {
    it('should always return content array with type and text', () => {
      const presenter = createSUT();
      const result = createSuccessResult();
      const metadata = createTestMetadata();
      
      const response = presenter.present(result, metadata);
      
      expect(response).toHaveProperty('content');
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.content[0]).toHaveProperty('type');
      expect(response.content[0]).toHaveProperty('text');
      expect(response.content[0].type).toBe('text');
    });
  });
  
  describe('when presenting errors', () => {
    it('should format validation errors in user-friendly way', () => {
      const presenter = createSUT();
      // Create a mock ZodError with the structure we need
      const zodError = Object.assign(new Error('Validation failed'), {
        name: 'ZodError',
        issues: [{
          code: 'too_small',
          minimum: 1,
          type: 'string',
          message: 'Scheme is required',
          path: ['scheme']
        }]
      });
      
      const response = presenter.presentError(zodError);
      
      // We WANT user-friendly messages, not JSON
      expect(response.content[0].text).toBe('❌ Scheme is required');
      expect(response.content[0].text).not.toContain('JSON');
      expect(response.content[0].text).not.toContain('[{');
    });
    
    it('should format multiple validation errors clearly', () => {
      const presenter = createSUT();
      // Create a real ZodError-like object with multiple issues
      const zodError = Object.assign(new Error('Validation failed'), {
        name: 'ZodError',
        issues: [
          { message: 'Scheme is required', path: ['scheme'] },
          { message: 'Invalid destination', path: ['destination'] }
        ]
      });
      
      const response = presenter.presentError(zodError);
      
      // We WANT clear, readable error messages
      expect(response.content[0].text).toContain('❌ Validation errors:');
      expect(response.content[0].text).toContain('Scheme is required');
      expect(response.content[0].text).toContain('Invalid destination');
    });
    
    it('should handle non-validation errors normally', () => {
      const presenter = createSUT();
      const error = new Error('Project path does not exist');
      
      const response = presenter.presentError(error);
      
      expect(response.content[0].text).toBe('❌ Project path does not exist');
    });
    
    it('should handle ZodError objects directly', () => {
      const presenter = createSUT();
      // Simulate a ZodError-like object
      const zodError = {
        name: 'ZodError',
        issues: [
          { message: 'Scheme is required', path: ['scheme'] },
          { message: 'Invalid destination', path: ['destination'] }
        ],
        message: 'Validation failed'
      };
      
      const response = presenter.presentError(zodError);
      
      // We WANT the issues formatted nicely
      expect(response.content[0].text).toContain('❌ Validation errors:');
      expect(response.content[0].text).toContain('Scheme is required');
      expect(response.content[0].text).toContain('Invalid destination');
    });
  });
});