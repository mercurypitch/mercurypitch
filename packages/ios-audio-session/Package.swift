// swift-tools-version: 5.9
//
// AudioSessionKit — the AVAudioSession configuration every Capacitor app in
// this repository needs, as one local Swift package.
//
// Each app's Xcode project references this directory as a LOCAL package
// (XCLocalSwiftPackageReference, relative path ../../../../packages/ios-audio-session
// from the app's ios/App/ folder). Deliberately NOT added through
// ios/App/CapApp-SPM/Package.swift, which the Capacitor CLI regenerates on
// every `cap sync`.
//
// No dependencies, no resources, iOS only: it is one file that has to run
// before the web layer exists, and it earns its own package purely so that
// two apps cannot drift apart on the two device failures it prevents.

import PackageDescription

let package = Package(
    name: "ios-audio-session",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "AudioSessionKit", targets: ["AudioSessionKit"])
    ],
    targets: [
        .target(name: "AudioSessionKit", path: "Sources/AudioSessionKit")
    ]
)
