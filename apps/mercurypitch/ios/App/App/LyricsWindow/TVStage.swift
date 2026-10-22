import UIKit
import WebKit

// The Karaoke room's stage on a TV connected to the iPhone: the pitch lane,
// the lyrics and the score, full screen in the TV's own landscape, while
// the phone stays the room and the microphone in whatever way it is held.
// A proof of concept for karaoke on a TV, after the lyrics (TVLyrics.swift).
//
// AirPlay screen mirroring, or a cable, makes iOS connect a scene with the
// external-display role. AppDelegate gives that scene no delegate, so iOS
// mirrors the phone (ios-external-display.test.ts). With the Developer
// screen's "Stage on a connected TV" on, this puts a window of its own on
// that scene instead, and iOS stops mirroring while the window is up. In the
// window is a plain web view with no Capacitor bridge and no plugins,
// showing the stage page (apps/mercurypitch/stage.html), served from the
// app's bundle under the bridge's own scheme by the bridge's own asset
// handler. The page draws what the room sends it (LyricsWindowPlugin
// passes each message on, `push`), and the last song and frame are kept for
// a page that loads after them. With the switch off, or once the window
// goes, the TV mirrors the phone again. The scene's role is non-interactive:
// the TV shows, the phone does. Everything here runs on the main thread.
final class TVStage: NSObject {
    /// A TV coming or going, and the stage going up on it or down.
    var changed: (_ connected: Bool, _ showing: Bool) -> Void = { _, _ in }
    /// A line for the log.
    var say: (String) -> Void = { _ in }

    /// Where the stage page is, and what serves it.
    struct Page {
        let url: URL
        let scheme: String
        let handler: WKURLSchemeHandler
    }

    /// The switch, kept on the phone across launches. Off unless a test
    /// build's Developer screen turns it on, so a store build mirrors.
    static let enabledKey = "mp.tvStage.enabled"
    private(set) var enabled = UserDefaults.standard.bool(forKey: TVStage.enabledKey)

    /// A TV is connected, whatever it shows.
    var connected: Bool { scene != nil }
    /// The TV shows the stage rather than the phone.
    var showing: Bool { window != nil }

    /// The page, looked up as the stage goes up: the bridge's web view and
    /// its scheme handler are the plugin's to reach.
    private let findPage: () -> Page?

    private var scene: UIWindowScene?
    private var window: UIWindow?
    private var webView: WKWebView?
    private var loaded = false
    private var lastSong: String?
    private var lastFrame: String?
    private var deliveryFailed = false
    private var observers: [NSObjectProtocol] = []

    init(page: @escaping () -> Page?) {
        findPage = page
        super.init()
        let center = NotificationCenter.default
        observers.append(center.addObserver(
            forName: UIScene.willConnectNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let scene = note.object as? UIWindowScene else { return }
            self?.connect(scene)
        })
        observers.append(center.addObserver(
            forName: UIScene.didDisconnectNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let scene = note.object as? UIWindowScene else { return }
            self?.disconnect(scene)
        })
    }

    deinit {
        for observer in observers {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    /// A TV that was connected before the plugin loaded.
    func lookForTV() {
        for case let scene as UIWindowScene in UIApplication.shared.connectedScenes where Self.isTV(scene) {
            connect(scene)
            return
        }
    }

    // MARK: - What the page says

    /// The Developer screen's switch.
    func setEnabled(_ on: Bool) {
        UserDefaults.standard.set(on, forKey: Self.enabledKey)
        guard on != enabled else {
            tell()
            return
        }
        enabled = on
        say("the stage on a connected TV \(on ? "on" : "off")")
        if on {
            show()
        } else {
            hide()
        }
        tell()
    }

    /// One message from the room, as JSON: a song, a frame, or idle. The
    /// newest of each is kept for a page that has not loaded yet.
    func push(_ json: String, kind: String) {
        switch kind {
        case "frame":
            lastFrame = json
        default:
            lastSong = json
            lastFrame = nil
        }
        deliver(json)
    }

    // MARK: - The TV

    private static func isTV(_ scene: UIScene) -> Bool {
        scene.session.role == .windowExternalDisplayNonInteractive
    }

    private func connect(_ scene: UIWindowScene) {
        guard Self.isTV(scene), scene !== self.scene else { return }
        self.scene = scene
        let size = scene.screen.bounds.size
        say("a TV connected, \(Int(size.width))x\(Int(size.height)) points")
        if enabled {
            show()
        } else {
            say("the stage's switch is off")
        }
        tell()
    }

    private func disconnect(_ scene: UIWindowScene) {
        guard scene === self.scene else { return }
        hide()
        self.scene = nil
        say("the TV went away")
        tell()
    }

    /// The stage up on the TV. iOS stops mirroring while the window is up.
    private func show() {
        guard window == nil, let scene else { return }
        guard let page = findPage() else {
            say("could not find the stage page: the TV mirrors the phone")
            return
        }
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(page.handler, forURLScheme: page.scheme)
        let web = WKWebView(frame: .zero, configuration: configuration)
        web.isOpaque = true
        web.backgroundColor = .black
        web.scrollView.isScrollEnabled = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.navigationDelegate = self
        let root = UIViewController()
        root.view.backgroundColor = .black
        web.frame = root.view.bounds
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        root.view.addSubview(web)
        let made = UIWindow(windowScene: scene)
        made.rootViewController = root
        made.isHidden = false
        window = made
        webView = web
        loaded = false
        deliveryFailed = false
        web.load(URLRequest(url: page.url))
        say("the stage is on the TV, in place of the phone")
    }

    /// The window gone, and the page with it, so iOS mirrors the phone again.
    private func hide() {
        guard let window else { return }
        webView?.navigationDelegate = nil
        webView?.stopLoading()
        webView = nil
        loaded = false
        window.isHidden = true
        self.window = nil
        say("the stage left the TV; it mirrors the phone again")
    }

    private func tell() {
        changed(connected, showing)
    }

    // MARK: - The page

    /// One message to the page, once it has loaded; until then it waits in
    /// `lastSong` and `lastFrame`.
    private func deliver(_ json: String) {
        guard loaded, let webView else { return }
        webView.callAsyncJavaScript(
            "if (window.__mpStage) { window.__mpStage.receive(message) }",
            arguments: ["message": json],
            in: nil,
            in: .page
        ) { [weak self] result in
            guard case let .failure(error) = result, let self, !self.deliveryFailed else { return }
            self.deliveryFailed = true
            self.say("could not hand the stage a message: \(error.localizedDescription)")
        }
    }

    fileprivate func pageLoaded(_ web: WKWebView) {
        guard web === webView else { return }
        loaded = true
        say("the stage page is up")
        if let lastSong {
            deliver(lastSong)
        }
        if let lastFrame {
            deliver(lastFrame)
        }
    }

    fileprivate func pageFailed(_ web: WKWebView, _ error: Error) {
        guard web === webView else { return }
        say("the stage page did not load: \(error.localizedDescription)")
    }

    fileprivate func pageCrashed(_ web: WKWebView) {
        guard web === webView else { return }
        loaded = false
        say("the stage page stopped; loading it again")
        web.reload()
    }
}

extension TVStage: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        pageLoaded(webView)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        pageFailed(webView, error)
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        pageFailed(webView, error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        pageCrashed(webView)
    }
}
