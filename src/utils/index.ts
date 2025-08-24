// Export device management
export { Devices, devices } from './devices/Devices.js';
export { SimulatorDevice } from './devices/SimulatorDevice.js';

// Export individual simulator components for testing
export { SimulatorBoot } from './devices/SimulatorBoot.js';
export { SimulatorReset } from './devices/SimulatorReset.js';
export { SimulatorApps } from './devices/SimulatorApps.js';
export { SimulatorUI } from './devices/SimulatorUI.js';
export { SimulatorInfo } from './devices/SimulatorInfo.js';

// Export Xcode project management
export { Xcode, xcode } from './projects/Xcode.js';
export { XcodeProject } from './projects/XcodeProject.js';
export { SwiftPackage } from './projects/SwiftPackage.js';

// Export Xcode components for testing
export { XcodeBuild } from './projects/XcodeBuild.js';
export { XcodeArchive } from './projects/XcodeArchive.js';
export { XcodeInfo } from './projects/XcodeInfo.js';
export { SwiftBuild } from './projects/SwiftBuild.js';
export { SwiftPackageInfo } from './projects/SwiftPackageInfo.js';