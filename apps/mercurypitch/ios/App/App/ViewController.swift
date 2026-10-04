import Capacitor
import UIKit

// The app's bridge, with the plugins that live in this app rather than in an
// npm package: Capacitor finds a package's plugins by itself and is told
// about these here, before the page loads. SceneDelegate and Main.storyboard
// both make this one.
class ViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LyricsWindowPlugin())
    }
}
