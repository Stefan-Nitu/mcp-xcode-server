import { CompileError } from './projects/XcodeBuild.js';

export interface BuildError {
  type: 'compile' | 'scheme' | 'signing' | 'provisioning' | 'dependency' | 'configuration' | 'generic';
  title: string;
  details?: string;
  suggestion?: string;
}

/**
 * Parse various types of build errors from xcodebuild output
 */
export function parseBuildErrors(output: string): BuildError[] {
  const errors: BuildError[] = [];
  const lines = output.split('\n');
  
  // Check for scheme not found
  if (output.includes('xcodebuild: error:') && output.includes('scheme')) {
    const schemeMatch = output.match(/xcodebuild: error:.*scheme\s+"([^"]+)"/i);
    errors.push({
      type: 'scheme',
      title: `Scheme not found${schemeMatch ? `: "${schemeMatch[1]}"` : ''}`,
      details: 'The specified scheme does not exist in the project',
      suggestion: 'Check available schemes with list_schemes tool'
    });
  }
  
  // Check for code signing errors
  if (output.match(/code\s*sign(ing)?\s*error|no signing certificate/i)) {
    const certMatch = output.match(/signing identity\s+"([^"]+)"/i);
    errors.push({
      type: 'signing',
      title: 'Code signing failed',
      details: certMatch ? `Missing signing identity: "${certMatch[1]}"` : 'No valid signing certificate found',
      suggestion: 'Check your Keychain for valid certificates or use automatic signing'
    });
  }
  
  // Check for provisioning profile errors
  if (output.match(/provisioning profile.*not found|no provisioning profile|requires a provisioning profile/i)) {
    const profileMatch = output.match(/provisioning profile\s+"([^"]+)"/i);
    const capabilityMatch = output.match(/doesn't support the (.+?) capability/i);
    
    errors.push({
      type: 'provisioning',
      title: 'Provisioning profile issue',
      details: profileMatch 
        ? `Profile "${profileMatch[1]}" not found or invalid`
        : capabilityMatch 
        ? `Profile doesn't support ${capabilityMatch[1]} capability`
        : 'No valid provisioning profile found',
      suggestion: 'Check your Apple Developer account or use automatic provisioning'
    });
  }
  
  // Check for missing dependencies
  if (output.match(/no such module|cannot find.*in scope|unresolved identifier/i)) {
    const moduleMatch = output.match(/no such module\s+'([^']+)'/i);
    errors.push({
      type: 'dependency',
      title: 'Missing dependency',
      details: moduleMatch ? `Module '${moduleMatch[1]}' not found` : 'Required dependency is missing',
      suggestion: 'Run "swift package resolve" or check your Package.swift/Podfile'
    });
  }
  
  // Check for configuration errors
  if (output.match(/configuration.*not found|invalid configuration/i)) {
    const configMatch = output.match(/configuration\s+"([^"]+)"/i);
    errors.push({
      type: 'configuration',
      title: 'Configuration error',
      details: configMatch ? `Configuration "${configMatch[1]}" not found` : 'Invalid build configuration',
      suggestion: 'Use Debug or Release, or check project for custom configurations'
    });
  }
  
  // Check for platform/destination errors
  if (output.match(/platform.*not supported|invalid destination|no destinations/i)) {
    const platformMatch = output.match(/platform\s+'([^']+)'/i);
    errors.push({
      type: 'configuration',
      title: 'Platform/Destination error',
      details: platformMatch 
        ? `Platform '${platformMatch[1]}' not supported by scheme`
        : 'Invalid or unsupported destination',
      suggestion: 'Check scheme settings or use a different platform'
    });
  }
  
  // Check for workspace/project errors (but not AXLoading errors about URLs)
  if (output.match(/workspace.*does not exist|\.xcodeproj.*does not exist|\.xcworkspace.*does not exist|could not find.*\.(xcodeproj|xcworkspace)/i) 
      && !output.includes('[AXLoading]')) {
    errors.push({
      type: 'configuration',
      title: 'Project not found',
      details: 'The specified project or workspace file does not exist',
      suggestion: 'Check the file path and ensure the project exists'
    });
  }
  
  // Check for generic xcodebuild errors
  if (errors.length === 0 && output.includes('xcodebuild: error:')) {
    const errorMatch = output.match(/xcodebuild: error:\s*(.+?)(?:\n|$)/);
    if (errorMatch) {
      errors.push({
        type: 'generic',
        title: 'Build failed',
        details: errorMatch[1].trim()
      });
    }
  }
  
  // Check for "The following build commands failed"
  if (output.includes('The following build commands failed:')) {
    const failedCommandsMatch = output.match(/The following build commands failed:\s*\n((?:.*\n){1,5})/);
    if (failedCommandsMatch && errors.length === 0) {
      errors.push({
        type: 'generic',
        title: 'Build commands failed',
        details: failedCommandsMatch[1].trim().split('\n').slice(0, 3).join('\n')
      });
    }
  }
  
  return errors;
}

/**
 * Format build errors for display
 */
export function formatBuildErrors(errors: BuildError[]): string {
  if (errors.length === 0) {
    return '';
  }
  
  let output = '❌ Build failed\n';
  
  for (const error of errors) {
    output += `\n📍 ${error.title}`;
    
    if (error.details) {
      output += `\n   ${error.details}`;
    }
    
    if (error.suggestion) {
      output += `\n   💡 ${error.suggestion}`;
    }
  }
  
  return output;
}