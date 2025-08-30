/**
 * Parse raw xcodebuild output into structured errors
 */

import { BuildError, BuildErrorType, CompileError } from '../types.js';

/**
 * Parse compile errors from xcodebuild output
 * These are actual code errors (syntax, type mismatches, etc.)
 */
export function parseCompileErrors(output: string): CompileError[] {
  const errors: CompileError[] = [];
  const lines = output.split('\n');
  
  // Match compile error patterns like:
  // /path/to/file.swift:10:5: error: cannot convert value of type 'String' to expected argument type 'Int'
  const errorPattern = /^(.+):(\d+):(\d+):\s*(error|warning|note):\s*(.+)$/;
  
  for (const line of lines) {
    const match = line.match(errorPattern);
    if (match) {
      errors.push({
        type: match[4] as 'error' | 'warning' | 'note',
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        message: match[5]
      });
    }
  }
  
  return errors;
}

/**
 * Parse build configuration errors from xcodebuild output
 * These are project configuration issues (scheme, SDK, signing, etc.)
 */
export function parseBuildErrors(output: string): BuildError[] {
  const errors: BuildError[] = [];
  
  // Check for scheme not found - must be on same line as xcodebuild: error:
  const schemeErrorMatch = output.match(/xcodebuild:\s*error:.*scheme/i);
  if (schemeErrorMatch) {
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
  
  // Check for unknown package in dependencies
  if (output.includes('unknown package') && output.includes('in dependencies')) {
    const packageMatch = output.match(/unknown package '([^']+)'/);
    const packageName = packageMatch ? packageMatch[1] : 'unknown';
    errors.push({
      type: 'dependency',
      title: 'Unknown package in dependencies',
      details: `Package '${packageName}' is not defined in Package.swift`,
      suggestion: 'Ensure the package is listed in the Package dependencies array'
    });
  }
  
  // Check for repository clone failures (covers both "Failed to clone" and "fatal: repository not found")
  if (output.includes('Failed to clone repository')) {
    const repoMatch = output.match(/Failed to clone repository (https?:\/\/[^\s:]+)/);
    const repoUrl = repoMatch ? repoMatch[1].trim() : 'unknown repository';
    errors.push({
      type: 'dependency',
      title: 'Failed to clone repository',
      details: `Could not fetch dependency from ${repoUrl}`,
      suggestion: 'Verify the repository URL exists and is accessible'
    });
  }
  // Check for standalone repository not found (when not part of clone failure)
  else if (output.includes('fatal: repository') && output.includes('not found')) {
    const repoMatch = output.match(/repository '([^']+)' not found/);
    const repoUrl = repoMatch ? repoMatch[1] : 'unknown repository';
    errors.push({
      type: 'dependency',
      title: 'Repository not found',
      details: `Repository ${repoUrl} does not exist`,
      suggestion: 'Check the package URL in Package.swift dependencies'
    });
  }
  
  // Check for SDK not installed errors
  if (output.includes('is not installed. To use with Xcode, first download and install the platform')) {
    const sdkMatch = output.match(/(\w+\s+[\d.]+)\s+is not installed/);
    const sdkName = sdkMatch ? sdkMatch[1] : 'Required SDK';
    errors.push({
      type: 'sdk',
      title: 'SDK not installed',
      details: `${sdkName} SDK is not installed`,
      suggestion: 'Install via: xcodebuild -downloadPlatform iOS or Xcode > Settings > Platforms'
    });
  }
  
  // Check for "Unable to find a destination" errors
  else if (output.includes('Unable to find a destination matching')) {
    const ineligibleMatch = output.match(/Ineligible destinations.*?:\s*((?:.*\n)*?)(?=\s*$)/);
    
    if (ineligibleMatch && ineligibleMatch[1].includes('is not installed')) {
      // This is actually an SDK issue
      const sdkMatch = ineligibleMatch[1].match(/(\w+\s+[\d.]+)\s+is not installed/);
      const sdkName = sdkMatch ? sdkMatch[1] : 'Required SDK';
      errors.push({
        type: 'sdk',
        title: 'SDK not installed',
        details: `${sdkName} SDK is not installed`,
        suggestion: 'Install via: xcodebuild -downloadPlatform iOS or Xcode > Settings > Platforms'
      });
    } else {
      errors.push({
        type: 'destination',
        title: 'No valid destination found',
        details: 'Unable to find a valid destination for building',
        suggestion: 'Check available simulators with "xcrun simctl list devices" or use a different platform'
      });
    }
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
  else if (output.match(/platform.*not supported|invalid destination|no destinations/i)) {
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
  
  // Check for workspace/project errors
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