import UIKit
import AudioSessionKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = AppBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// The bridge, with the app's own plugins on it. Capacitor finds the npm
/// plugins by itself; a plugin that lives in the app is handed over here.
class AppBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AudioSessionPlugin())
    }
}

/// The web layer's say over whether the app's sound mixes with other apps'
/// (`AudioSession.setMixesWithOthers`): off while a song of the app's own is
/// playing, because iOS gives Now Playing and the lock screen's buttons only
/// to an app that does not mix. It answers with what the session became, so
/// the debug console can show it on a phone with no Mac attached.
@objc(AudioSessionPlugin)
public class AudioSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioSessionPlugin"
    public let jsName = "AudioSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setMixesWithOthers", returnType: CAPPluginReturnPromise),
    ]

    @objc func setMixesWithOthers(_ call: CAPPluginCall) {
        let mixes = call.getBool("mixes") ?? true
        DispatchQueue.main.async {
            AudioSession.setMixesWithOthers(mixes)
            call.resolve(["session": AudioSession.describe()])
        }
    }
}
