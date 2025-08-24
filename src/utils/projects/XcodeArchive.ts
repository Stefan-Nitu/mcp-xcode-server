import { execAsync } from '../../utils.js';
import { createModuleLogger } from '../../logger.js';
import { Platform } from '../../types.js';
import { PlatformHandler } from '../../platformHandler.js';
import path from 'path';

const logger = createModuleLogger('XcodeArchive');

export interface ArchiveOptions {
  scheme: string;
  configuration?: string;
  platform?: Platform;
  archivePath?: string;
}

export interface ExportOptions {
  exportMethod?: 'app-store' | 'ad-hoc' | 'enterprise' | 'development';
  exportPath?: string;
}

/**
 * Handles archiving and exporting for Xcode projects
 */
export class XcodeArchive {
  /**
   * Archive an Xcode project
   */
  async archive(
    projectPath: string,
    isWorkspace: boolean,
    options: ArchiveOptions
  ): Promise<{ success: boolean; archivePath: string }> {
    const {
      scheme,
      configuration = 'Release',
      platform = Platform.iOS,
      archivePath
    } = options;
    
    // Generate archive path if not provided
    const finalArchivePath = archivePath || 
      `./build/${scheme}-${new Date().toISOString().split('T')[0]}.xcarchive`;
    
    const projectFlag = isWorkspace ? '-workspace' : '-project';
    let command = `xcodebuild archive ${projectFlag} "${projectPath}"`;
    command += ` -scheme "${scheme}"`;
    command += ` -configuration "${configuration}"`;
    command += ` -archivePath "${finalArchivePath}"`;
    
    // Add platform-specific destination
    const destination = PlatformHandler.getGenericDestination(platform);
    command += ` -destination "${destination}"`;
    
    logger.debug({ command }, 'Archive command');
    
    try {
      const { stdout } = await execAsync(command, { 
        maxBuffer: 50 * 1024 * 1024 
      });
      
      logger.info({ 
        projectPath, 
        scheme, 
        archivePath: finalArchivePath 
      }, 'Archive succeeded');
      
      return {
        success: true,
        archivePath: finalArchivePath
      };
    } catch (error: any) {
      logger.error({ error: error.message, projectPath }, 'Archive failed');
      throw new Error(`Archive failed: ${error.message}`);
    }
  }
  
  /**
   * Export an IPA from an archive
   */
  async exportIPA(
    archivePath: string,
    options: ExportOptions = {}
  ): Promise<{ success: boolean; ipaPath: string }> {
    const {
      exportMethod = 'development',
      exportPath = './build'
    } = options;
    
    // Create export options plist
    const exportPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>${exportMethod}</string>
    <key>compileBitcode</key>
    <false/>
</dict>
</plist>`;
    
    // Write plist to temp file
    const tempPlistPath = path.join(exportPath, 'ExportOptions.plist');
    const { writeFile, mkdir } = await import('fs/promises');
    await mkdir(exportPath, { recursive: true });
    await writeFile(tempPlistPath, exportPlist);
    
    const command = `xcodebuild -exportArchive -archivePath "${archivePath}" -exportPath "${exportPath}" -exportOptionsPlist "${tempPlistPath}"`;
    
    logger.debug({ command }, 'Export command');
    
    try {
      const { stdout } = await execAsync(command, { 
        maxBuffer: 10 * 1024 * 1024 
      });
      
      // Find the IPA file in the export directory
      const { readdir } = await import('fs/promises');
      const files = await readdir(exportPath);
      const ipaFile = files.find(f => f.endsWith('.ipa'));
      
      if (!ipaFile) {
        throw new Error('IPA file not found in export directory');
      }
      
      const ipaPath = path.join(exportPath, ipaFile);
      
      // Clean up temp plist
      const { unlink } = await import('fs/promises');
      await unlink(tempPlistPath).catch(() => {});
      
      logger.info({ 
        archivePath, 
        ipaPath,
        exportMethod 
      }, 'IPA export succeeded');
      
      return {
        success: true,
        ipaPath
      };
    } catch (error: any) {
      logger.error({ error: error.message, archivePath }, 'Export failed');
      
      // Clean up temp plist
      const { unlink } = await import('fs/promises');
      await unlink(tempPlistPath).catch(() => {});
      
      throw new Error(`Export failed: ${error.message}`);
    }
  }
}