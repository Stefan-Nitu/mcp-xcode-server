// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "XcodeProjectModifier",
    platforms: [.macOS(.v10_15)],
    dependencies: [
        .package(url: "https://github.com/tuist/XcodeProj.git", from: "8.0.0"),
        .package(url: "https://github.com/apple/swift-argument-parser", from: "1.0.0")
    ],
    targets: [
        .executableTarget(
            name: "XcodeProjectModifier",
            dependencies: [
                "XcodeProj",
                .product(name: "ArgumentParser", package: "swift-argument-parser")
            ]
        )
    ]
)