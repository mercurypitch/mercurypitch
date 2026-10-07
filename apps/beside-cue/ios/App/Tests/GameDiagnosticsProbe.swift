// Native diagnostic probe verifies durable bounded history and Objective-C delegate forwarding.
import Foundation
import WebKit

private final class OriginalDelegate: NSObject, WKNavigationDelegate {
    var finished = 0
    var terminated = 0
    var onTermination: (() -> Void)?

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        finished += 1
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        terminated += 1
        onTermination?()
    }
}

@main
private enum GameDiagnosticsProbe {
    @MainActor static func main() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("game-diagnostics-probe-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: directory) }
        let file = directory.appendingPathComponent("events.json")
        let store = GameDiagnosticStore(file: file, version: "1", build: "850", launchId: "first")
        store.record("native-launch")
        for _ in 0..<20 { store.record("memory-warning") }
        store.record("unknown")
        let reloaded = GameDiagnosticStore(file: file, version: "1", build: "851", launchId: "next")
        let history = reloaded.snapshot()["events"] as! [[String: Any]]
        precondition(history.count == 16, "history must remain bounded")
        precondition(history.allSatisfy { $0["launchId"] as? String == "first" && $0["build"] as? String == "850" },
                     "retained events keep their original native build identity")
        precondition(reloaded.snapshot()["build"] as? String == "851", "current native identity must be separate")
        precondition(Set(history.compactMap { $0["id"] as? String }).count == 16, "events need stable distinct IDs")

        let webView = WKWebView(frame: .zero)
        weak var originalReference: OriginalDelegate?
        weak var proxyReference: GameDiagnosticNavigationDelegate?
        autoreleasepool {
            var original: OriginalDelegate? = OriginalDelegate()
            originalReference = original
            original?.onTermination = {
                let persisted = GameDiagnosticStore(file: file, version: "1", build: "850").snapshot()
                let events = persisted["events"] as! [[String: Any]]
                precondition(events.last?["kind"] as? String == "web-content-terminated",
                             "the breadcrumb must be on disk before forwarding termination")
            }
            var proxy: GameDiagnosticNavigationDelegate? = GameDiagnosticNavigationDelegate(downstream: original!) {
                store.record("web-content-terminated")
            }
            proxyReference = proxy
            webView.navigationDelegate = proxy
            original = nil
            precondition(originalReference != nil, "proxy must retain the original weak WebKit delegate")
            precondition(proxy!.responds(to: #selector(WKNavigationDelegate.webView(_:didFinish:))),
                         "forwarded selectors must remain advertised")
            precondition(!proxy!.responds(to: NSSelectorFromString("unsupportedDiagnosticSelector")),
                         "unimplemented selectors must not be advertised")
            webView.navigationDelegate?.webView?(webView, didFinish: nil)
            webView.navigationDelegate?.webViewWebContentProcessDidTerminate?(webView)
            precondition(originalReference?.finished == 1, "ordinary navigation callback must forward exactly once")
            precondition(originalReference?.terminated == 1, "termination must forward exactly once")
            proxy = nil
        }
        precondition(proxyReference == nil && originalReference == nil && webView.navigationDelegate == nil,
                     "the proxy chain must release after its owner releases it")

        try Data("broken".utf8).write(to: file)
        precondition((GameDiagnosticStore(file: file, version: "1", build: "850").snapshot()["events"] as! [Any]).isEmpty,
                     "corrupt history must not block launch")
        try Data(repeating: 32, count: 65537).write(to: file)
        precondition((GameDiagnosticStore(file: file, version: "1", build: "850").snapshot()["events"] as! [Any]).isEmpty,
                     "oversized history must not be loaded")
        print("Native diagnostic persistence, forwarding and ownership probe passed")
    }
}
