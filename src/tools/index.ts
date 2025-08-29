/**
 * Central export for all tool classes
 */

// Simulator management tools
export { ListSimulatorsTool } from './simulator/ListSimulatorsTool.js';
export { BootSimulatorTool } from './simulator/BootSimulatorTool.js';
export { ShutdownSimulatorTool } from './simulator/ShutdownSimulatorTool.js';
export { ViewSimulatorScreenTool } from './simulator/ViewSimulatorScreenTool.js';

// Build and test tools
export { BuildSwiftPackageTool } from './execution/BuildSwiftPackageTool.js';
export { RunSwiftPackageTool } from './execution/RunSwiftPackageTool.js';
export { BuildXcodeTool } from './execution/BuildXcodeTool.js';
export { RunXcodeTool } from './execution/RunXcodeTool.js';
export { TestXcodeTool } from './test/TestXcodeTool.js';
export { TestSwiftPackageTool } from './test/TestSwiftPackageTool.js';
export { CleanBuildTool } from './execution/CleanBuildTool.js';

// Archive and export tools
export { ArchiveProjectTool } from './distribution/ArchiveProjectTool.js';
export { ExportIPATool } from './distribution/ExportIPATool.js';

// Project info and scheme tools
export { ListSchemesTool } from './project/ListSchemesTool.js';
export { GetBuildSettingsTool } from './project/GetBuildSettingsTool.js';
export { GetProjectInfoTool } from './project/GetProjectInfoTool.js';
export { ListTargetsTool } from './project/ListTargetsTool.js';

// App management tools
export { InstallAppTool } from './app/InstallAppTool.js';
export { UninstallAppTool } from './app/UninstallAppTool.js';

// Device logs
export { GetDeviceLogsTool } from './diagnostics/GetDeviceLogsTool.js';

// Advanced project management tools
export { ManageDependenciesTool } from './dependencies/ManageDependenciesTool.js';

// Export validators for use in other tools
export * from './validators.js';