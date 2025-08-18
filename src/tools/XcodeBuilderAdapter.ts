/**
 * Adapter to handle both static and instance methods of XcodeBuilder
 * This allows for dependency injection in tests while maintaining compatibility with the static API
 */
export class XcodeBuilderAdapter {
  constructor(private xcodeBuilder: any) {}

  async buildProject(config: any) {
    const buildMethod = typeof this.xcodeBuilder === 'function' 
      ? this.xcodeBuilder.buildProject
      : this.xcodeBuilder.buildProjectInstance;
    
    return buildMethod.call(this.xcodeBuilder, config);
  }

  async testProject(config: any) {
    const testMethod = typeof this.xcodeBuilder === 'function' 
      ? this.xcodeBuilder.testProject
      : this.xcodeBuilder.testProjectInstance;
    
    return testMethod.call(this.xcodeBuilder, config);
  }

  async cleanProject(config: any) {
    const cleanMethod = typeof this.xcodeBuilder === 'function' 
      ? this.xcodeBuilder.cleanProject
      : this.xcodeBuilder.cleanProjectInstance;
    
    return cleanMethod.call(this.xcodeBuilder, config);
  }

  async testSPMModule(packagePath: string, platform: any, testFilter?: string, osVersion?: string) {
    const testMethod = typeof this.xcodeBuilder === 'function' 
      ? this.xcodeBuilder.testSPMModule
      : this.xcodeBuilder.testSPMModuleInstance;
    
    return testMethod.call(this.xcodeBuilder, packagePath, platform, testFilter, osVersion);
  }

  async listSchemes(projectPath: string, shared?: boolean) {
    const method = typeof this.xcodeBuilder === 'function' 
      ? this.xcodeBuilder.listSchemes
      : this.xcodeBuilder.listSchemesInstance;
    
    return method?.call(this.xcodeBuilder, projectPath, shared);
  }

  async getBuildSettings(projectPath: string, scheme: string, configuration?: string, platform?: any) {
    const method = typeof this.xcodeBuilder === 'function' 
      ? this.xcodeBuilder.getBuildSettings
      : this.xcodeBuilder.getBuildSettingsInstance;
    
    return method?.call(this.xcodeBuilder, projectPath, scheme, configuration, platform);
  }

  async archiveProject(projectPath: string, scheme: string, platform: any, configuration: string, archivePath?: string) {
    const method = typeof this.xcodeBuilder === 'function' 
      ? this.xcodeBuilder.archiveProject
      : this.xcodeBuilder.archiveProjectInstance;
    
    return method?.call(this.xcodeBuilder, projectPath, scheme, platform, configuration, archivePath);
  }

  async exportIPA(archivePath: string, exportPath?: string, exportMethod?: string) {
    const method = typeof this.xcodeBuilder === 'function' 
      ? this.xcodeBuilder.exportIPA
      : this.xcodeBuilder.exportIPAInstance;
    
    return method?.call(this.xcodeBuilder, archivePath, exportPath, exportMethod);
  }

  async getProjectInfo(projectPath: string) {
    const method = typeof this.xcodeBuilder === 'function' 
      ? this.xcodeBuilder.getProjectInfo
      : this.xcodeBuilder.getProjectInfoInstance;
    
    return method?.call(this.xcodeBuilder, projectPath);
  }

  async listTargets(projectPath: string) {
    const method = typeof this.xcodeBuilder === 'function' 
      ? this.xcodeBuilder.listTargets
      : this.xcodeBuilder.listTargetsInstance;
    
    return method?.call(this.xcodeBuilder, projectPath);
  }
}