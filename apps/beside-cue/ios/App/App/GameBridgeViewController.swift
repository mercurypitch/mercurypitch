// The games test host retains Capacitor's delegate and adds bounded native diagnostics.
import Capacitor

final class GameBridgeViewController: CAPBridgeViewController {
    private var diagnosticDelegate: GameDiagnosticNavigationDelegate?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard GameDiagnostics.enabled, let webView = webView,
              let downstream = webView.navigationDelegate else { return }
        let observer = GameDiagnosticNavigationDelegate(downstream: downstream) {
            GameDiagnostics.record("web-content-terminated")
        }
        diagnosticDelegate = observer // WKWebView's delegate reference is weak.
        webView.navigationDelegate = observer
        bridge?.registerPluginInstance(GameDiagnosticsPlugin())
    }
}
