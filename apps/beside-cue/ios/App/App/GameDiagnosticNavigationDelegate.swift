// Observe WebContent termination while forwarding Capacitor's navigation behavior unchanged.
import WebKit

final class GameDiagnosticNavigationDelegate: NSObject, WKNavigationDelegate {
    private let downstream: WKNavigationDelegate
    private let recordTermination: () -> Void

    init(downstream: WKNavigationDelegate, recordTermination: @escaping () -> Void) {
        self.downstream = downstream
        self.recordTermination = recordTermination
        super.init()
    }

    override func responds(to selector: Selector!) -> Bool {
        super.responds(to: selector) || downstream.responds(to: selector)
    }

    override func forwardingTarget(for selector: Selector!) -> Any? {
        downstream.responds(to: selector) ? downstream : super.forwardingTarget(for: selector)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        recordTermination()
        // Capacitor 8.5 owns bridge.reset() and the single reload. This proxy must
        // never reload, reset, replace the URL or infer why WebKit terminated.
        downstream.webViewWebContentProcessDidTerminate?(webView)
    }
}
