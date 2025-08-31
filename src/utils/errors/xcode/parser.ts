/**
 * Parse raw xcodebuild output into structured errors
 */

import { BuildError, BuildErrorType, CompileError } from '../types.js';

/**
 * Parse compile errors and warnings from xcodebuild output
 * Returns them separated for easy handling
 */
export function parseCompileErrors(output: string): { 
  errors: CompileError[]; 
  warnings: CompileError[];
} {
  const errors: CompileError[] = [];
  const warnings: CompileError[] = [];
  const lines = output.split('\n');
  
  // Track seen items to avoid duplicates
  const seen = new Set<string>();
  
  for (const line of lines) {
    // Look for lines containing ": error:" or ": warning:"
    const errorIndex = line.indexOf(': error:');
    const warningIndex = line.indexOf(': warning:');
    const noteIndex = line.indexOf(': note:');
    
    let typeIndex = -1;
    let type: 'error' | 'warning' | 'note' | null = null;
    
    if (errorIndex !== -1) {
      typeIndex = errorIndex;
      type = 'error';
    } else if (warningIndex !== -1) {
      typeIndex = warningIndex;
      type = 'warning';
    } else if (noteIndex !== -1) {
      typeIndex = noteIndex;
      type = 'note';
    }
    
    if (type && typeIndex > 0) {
      // Extract the file:line:column part before the type
      const beforeType = line.substring(0, typeIndex).trim();
      const afterType = line.substring(typeIndex + type.length + 3).trim(); // +3 for ": :" 
      
      // Try to find file:line:column pattern
      // Look for the last occurrence of :number:number pattern
      const lastColonIndex = beforeType.lastIndexOf(':');
      if (lastColonIndex === -1) continue;
      
      const beforeLastColon = beforeType.substring(0, lastColonIndex);
      const afterLastColon = beforeType.substring(lastColonIndex + 1);
      
      // Check if after last colon is a number (column)
      const column = parseInt(afterLastColon, 10);
      if (isNaN(column)) continue;
      
      // Find the second-to-last colon for line number
      const secondLastColonIndex = beforeLastColon.lastIndexOf(':');
      if (secondLastColonIndex === -1) continue;
      
      const beforeSecondLastColon = beforeLastColon.substring(0, secondLastColonIndex);
      const afterSecondLastColon = beforeLastColon.substring(secondLastColonIndex + 1);
      
      // Check if this is a line number
      const lineNum = parseInt(afterSecondLastColon, 10);
      if (isNaN(lineNum)) continue;
      
      // Everything before should be the file path
      const file = beforeSecondLastColon.trim();
      if (!file) continue;
      
      // Create unique key for deduplication
      const key = `${file}:${lineNum}:${column}:${afterType}`;
      if (seen.has(key)) continue;
      seen.add(key);
      
      const item: CompileError = {
        type,
        file,
        line: lineNum,
        column,
        message: afterType
      };
      
      if (type === 'error') {
        errors.push(item);
      } else if (type === 'warning') {
        warnings.push(item);
      }
      // Note: we ignore 'note' type for now
    }
  }
  
  return { errors, warnings };
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
    // Extract the requested destination
    const requestedDestMatch = output.match(/Unable to find a destination matching.*?:\s*\{([^}]+)\}/);
    let requestedDetails = '';
    if (requestedDestMatch) {
      requestedDetails = requestedDestMatch[1].trim();
    }
    
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
      // Extract specific issue from requested destination
      let details = 'Unable to find a valid destination for building';
      let suggestion = 'Check available simulators with "xcrun simctl list devices"';
      
      if (requestedDetails) {
        // Check if it's a specific device ID
        if (requestedDetails.includes('id:')) {
          const idMatch = requestedDetails.match(/id:([^,\s]+)/);
          if (idMatch) {
            const deviceId = idMatch[1];
            
            // Try to determine why the device isn't available by looking at the output
            const hasAvailableDestinations = output.includes('Available destinations');
            const hasOSVersions = output.includes('OS:');
            
            if (hasAvailableDestinations && hasOSVersions) {
              // The output shows other devices WITH OS versions, suggesting this is a compatibility issue
              // TODO: We should parse the actual minimum iOS version from available devices
              details = `Device '${deviceId}' is incompatible with project requirements`;
              suggestion = 'The device likely has an older iOS version than required. Check available destinations in the log for compatible devices.';
            } else if (hasAvailableDestinations) {
              // We see available destinations but no OS versions - device probably doesn't exist
              details = `Device '${deviceId}' not found`;
              suggestion = 'The device ID may be invalid. Use list_simulators to find valid device IDs.';
            } else {
              // Generic error - we don't have enough information
              details = `Device '${deviceId}' could not be used`;
              suggestion = 'Check if the device exists and is compatible with the project requirements.';
            }
          }
        } else if (requestedDetails.includes('name:')) {
          const nameMatch = requestedDetails.match(/name:([^,]+)/);
          if (nameMatch) {
            details = `Device '${nameMatch[1].trim()}' not found`;
            suggestion = 'Check device name or use list_simulators to find available devices';
          }
        } else {
          // Check if this is a platform availability issue
          // If requesting just a platform (e.g., "platform:iOS") and available destinations don't include it
          const trimmed = requestedDetails.trim();
          if (trimmed.startsWith('platform:')) {
            // Extract platform name (everything after "platform:")
            const requestedPlatform = trimmed.substring('platform:'.length).trim();
            
            // Check if the requested platform appears in the available destinations
            if (output.includes('Available destinations')) {
              const availableSection = output.substring(output.indexOf('Available destinations'));
              if (!availableSection.includes(`platform:${requestedPlatform}`)) {
                // Platform is not in the available list
                details = `${requestedPlatform} platform is not available`;
                suggestion = `Install ${requestedPlatform} support via Xcode > Settings > Platforms or xcodebuild -downloadPlatform ${requestedPlatform}`;
              } else {
                details = `Destination not found: ${requestedDetails}`;
              }
            } else {
              details = `Destination not found: ${requestedDetails}`;
            }
          } else {
            details = `Destination not found: ${requestedDetails}`;
          }
        }
      }
      
      errors.push({
        type: 'destination',
        title: 'Destination not available',
        details,
        suggestion
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
    
    // Try to extract the correct platform from available destinations or platforms list
    let correctPlatform: string | undefined;
    
    // First check for "Available platforms: ..." format from validatePlatformSupport
    const availablePlatformsMatch = output.match(/Available platforms:\s*(.+)/i);
    if (availablePlatformsMatch) {
      const platforms = availablePlatformsMatch[1].split(',').map(p => p.trim());
      if (platforms.length > 0) {
        correctPlatform = platforms[0];
      }
    }
    
    // Otherwise check for xcodebuild's "Available destinations" output
    if (!correctPlatform) {
      const availableDestMatch = output.match(/Available destinations.*?scheme[:\s]*\n([\s\S]*?)(?:\n\n|\z)/);
      if (availableDestMatch) {
        // Extract unique platforms from the destination list
        const platformRegex = /platform:(\w+)/g;
        const platforms = new Set<string>();
        let match;
        while ((match = platformRegex.exec(availableDestMatch[1])) !== null) {
          platforms.add(match[1]);
        }
        // Get the first platform (they're usually all the same for a scheme)
        if (platforms.size > 0) {
          correctPlatform = Array.from(platforms)[0];
        }
      }
    }
    
    errors.push({
      type: 'configuration',
      title: 'Platform/Destination error',
      details: platformMatch 
        ? `Platform '${platformMatch[1]}' not supported by scheme`
        : 'Invalid or unsupported destination',
      suggestion: correctPlatform 
        ? `Use platform: ${correctPlatform}`
        : 'Check scheme settings or use a different platform'
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