import UIKit
import AudioSessionKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Before the web layer exists, because WKWebView inherits
        // whatever session it finds. See packages/ios-audio-session for why an
        // app with no category at all is an app with no sound.
        AudioSession.configure()
        NSLog("[AudioSession] at launch: \(AudioSession.describe())")
        // Also before the web layer exists, so the directory carries the flag
        // before WebKit writes the first byte into it.
        LocalDataBackupPolicy.apply()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

/// Keeps what the app stores out of iCloud and Finder/iTunes backups, the iOS
/// counterpart of android/app/src/main/res/xml/backup_rules.xml, so the Settings
/// wording "on this device only" holds on both platforms.
///
/// Everything the web layer persists lives under Library/WebKit in the app's
/// container: the IndexedDB snapshot with the plan, choice history and settings
/// (src/infrastructure/indexed-db-repository.ts) and the localStorage onboarding
/// marker and game preferences. Flagging that directory excludes everything
/// beneath it. It is created here because a fresh install has none yet, and
/// WebKit adopts an existing one. Re-applied on every launch; the flag is
/// idempotent, and the read-back line is what a device log check looks for.
enum LocalDataBackupPolicy {
    static func apply() {
        let fileManager = FileManager.default
        guard let library = fileManager.urls(for: .libraryDirectory, in: .userDomainMask).first else {
            NSLog("[BackupPolicy] no Library directory; website data stays backup-eligible")
            return
        }
        var websiteData = library.appendingPathComponent("WebKit", isDirectory: true)
        do {
            try fileManager.createDirectory(at: websiteData, withIntermediateDirectories: true)
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try websiteData.setResourceValues(values)
            let excluded = try websiteData.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup ?? false
            NSLog("[BackupPolicy] Library/WebKit excluded from backup: \(excluded)")
        } catch {
            NSLog("[BackupPolicy] could not exclude Library/WebKit from backup: \(error)")
        }
    }
}
