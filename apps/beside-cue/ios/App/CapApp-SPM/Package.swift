// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.0"),
        .package(name: "CapacitorHaptics", path: "../../../../../node_modules/.pnpm/@capacitor+haptics@8.0.2_@capacitor+core@8.5.0/node_modules/@capacitor/haptics"),
        .package(name: "CapacitorLocalNotifications", path: "../../../../../node_modules/.pnpm/@capacitor+local-notifications@8.2.1_@capacitor+core@8.5.0/node_modules/@capacitor/local-notifications"),
        .package(name: "RevenuecatPurchasesCapacitor", path: "../../../../../node_modules/.pnpm/@revenuecat+purchases-capacitor@13.4.0_@capacitor+core@8.5.0/node_modules/@revenuecat/purchases-capacitor"),
        .package(name: "RevenuecatPurchasesCapacitorUi", path: "../../../../../node_modules/.pnpm/@revenuecat+purchases-capacitor-ui@13.4.0_@capacitor+core@8.5.0_@revenuecat+purchases-c_52656dc8f7054b6a8a9be9cf6f9a3d98/node_modules/@revenuecat/purchases-capacitor-ui")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics"),
                .product(name: "CapacitorLocalNotifications", package: "CapacitorLocalNotifications"),
                .product(name: "RevenuecatPurchasesCapacitor", package: "RevenuecatPurchasesCapacitor"),
                .product(name: "RevenuecatPurchasesCapacitorUi", package: "RevenuecatPurchasesCapacitorUi")
            ]
        )
    ]
)
