// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v16)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.0"),
        .package(name: "CapacitorCommunityKeepAwake", path: "../../../../../node_modules/.pnpm/@capacitor-community+keep-awake@8.0.1_@capacitor+core@8.5.0/node_modules/@capacitor-community/keep-awake"),
        .package(name: "CapacitorApp", path: "../../../../../node_modules/.pnpm/@capacitor+app@8.1.1_@capacitor+core@8.5.0/node_modules/@capacitor/app"),
        .package(name: "CapacitorDevice", path: "../../../../../node_modules/.pnpm/@capacitor+device@8.0.3_@capacitor+core@8.5.0/node_modules/@capacitor/device"),
        .package(name: "CapacitorHaptics", path: "../../../../../node_modules/.pnpm/@capacitor+haptics@8.0.2_@capacitor+core@8.5.0/node_modules/@capacitor/haptics"),
        .package(name: "CapacitorKeyboard", path: "../../../../../node_modules/.pnpm/@capacitor+keyboard@8.0.5_@capacitor+core@8.5.0/node_modules/@capacitor/keyboard"),
        .package(name: "CapacitorPreferences", path: "../../../../../node_modules/.pnpm/@capacitor+preferences@8.0.1_@capacitor+core@8.5.0/node_modules/@capacitor/preferences"),
        .package(name: "CapacitorShare", path: "../../../../../node_modules/.pnpm/@capacitor+share@8.0.1_@capacitor+core@8.5.0/node_modules/@capacitor/share"),
        .package(name: "CapacitorStatusBar", path: "../../../../../node_modules/.pnpm/@capacitor+status-bar@8.0.3_@capacitor+core@8.5.0/node_modules/@capacitor/status-bar"),
        .package(name: "CapgoCapacitorMediaSession", path: "../../../../../node_modules/.pnpm/@capgo+capacitor-media-session@8.0.32_@capacitor+core@8.5.0/node_modules/@capgo/capacitor-media-session"),
        .package(name: "CapgoCapacitorSocialLogin", path: "../../../../../node_modules/.pnpm/@capgo+capacitor-social-login@8.5.7_@capacitor+core@8.5.0/node_modules/@capgo/capacitor-social-login"),
        .package(name: "RevenuecatPurchasesCapacitor", path: "../../../../../node_modules/.pnpm/@revenuecat+purchases-capacitor@13.4.0_@capacitor+core@8.5.0/node_modules/@revenuecat/purchases-capacitor"),
        .package(name: "RevenuecatPurchasesCapacitorUi", path: "../../../../../node_modules/.pnpm/@revenuecat+purchases-capacitor-ui@13.4.0_@capacitor+core@8.5.0_@revenuecat+purchases-c_52656dc8f7054b6a8a9be9cf6f9a3d98/node_modules/@revenuecat/purchases-capacitor-ui"),
        .package(name: "CapacitorNativeSettings", path: "../../../../../node_modules/.pnpm/capacitor-native-settings@8.2.0_@capacitor+core@8.5.0/node_modules/capacitor-native-settings")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunityKeepAwake", package: "CapacitorCommunityKeepAwake"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorDevice", package: "CapacitorDevice"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics"),
                .product(name: "CapacitorKeyboard", package: "CapacitorKeyboard"),
                .product(name: "CapacitorPreferences", package: "CapacitorPreferences"),
                .product(name: "CapacitorShare", package: "CapacitorShare"),
                .product(name: "CapacitorStatusBar", package: "CapacitorStatusBar"),
                .product(name: "CapgoCapacitorMediaSession", package: "CapgoCapacitorMediaSession"),
                .product(name: "CapgoCapacitorSocialLogin", package: "CapgoCapacitorSocialLogin"),
                .product(name: "RevenuecatPurchasesCapacitor", package: "RevenuecatPurchasesCapacitor"),
                .product(name: "RevenuecatPurchasesCapacitorUi", package: "RevenuecatPurchasesCapacitorUi"),
                .product(name: "CapacitorNativeSettings", package: "CapacitorNativeSettings")
            ]
        )
    ]
)
