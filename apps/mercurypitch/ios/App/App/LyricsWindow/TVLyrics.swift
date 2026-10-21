import CoreGraphics
import CoreVideo
import QuartzCore
import UIKit
import VideoToolbox

// The Karaoke room's lyrics on a TV connected to the iPhone, full screen,
// while the phone stays the room: a proof of concept for karaoke on a TV.
//
// AirPlay screen mirroring, or a cable, makes iOS connect a scene with the
// external-display role. AppDelegate gives that scene no delegate, so iOS
// mirrors the phone (ios-external-display.test.ts). With the Developer
// screen's "Lyrics on a connected TV" on, this puts a window of its own on
// that scene instead, and iOS stops mirroring while the window is up: the
// lyrics, drawn by the lyrics window's renderer at the TV's size, from the
// lyrics and the clock the page already hands the lyrics window
// (LyricsWindowPlugin passes both on). With the switch off, or once the
// window goes, the TV mirrors the phone again. The scene's role is
// non-interactive: the TV shows, the phone does.
//
// With no song in the room the TV shows the app's name, so a tester can see
// the TV is held. Everything here runs on the main thread.
final class TVLyrics: NSObject {
    /// A TV coming or going, and the lyrics going up on it or down.
    var changed: (_ connected: Bool, _ showing: Bool) -> Void = { _, _ in }
    /// A line for the log.
    var say: (String) -> Void = { _ in }

    /// The switch, kept on the phone across launches. Off unless a test
    /// build's Developer screen turns it on, so a store build mirrors.
    static let enabledKey = "mp.tvLyrics.enabled"
    private(set) var enabled = UserDefaults.standard.bool(forKey: TVLyrics.enabledKey)

    /// A TV is connected, whatever it shows.
    var connected: Bool { scene != nil }
    /// The TV shows the lyrics rather than the phone.
    var showing: Bool { window != nil }

    /// The frame drawn for the TV: 16:9, the shape the renderer lays out,
    /// fitted to the screen whatever its own size.
    private static let pixelWidth = 1920
    private static let pixelHeight = 1080

    /// What the TV shows with no song in the room: the app's name, big.
    private static let idle = LyricsWindowScript(title: "Mercury Pitch", duration: 0, segments: [])

    private var script: LyricsWindowScript?
    private var clock = LyricsClock()
    private var scene: UIWindowScene?
    private var window: UIWindow?
    private var picture: UIView?
    private var renderer: LyricsWindowRenderer?
    private var link: CADisplayLink?
    private var drawnAt: Double?
    private var imageFailed = false
    private var observers: [NSObjectProtocol] = []

    override init() {
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
        link?.invalidate()
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
        say("lyrics on a connected TV \(on ? "on" : "off")")
        if on {
            show()
        } else {
            hide()
        }
        tell()
    }

    /// The song's lyrics, as the lyrics window gets them, or nil for none.
    func setScript(_ script: LyricsWindowScript?) {
        self.script = script
        drawnAt = nil
        drawFrame()
    }

    /// A Now Playing report, as the lyrics window gets it.
    func setClock(playing: Bool, position: Double, rate: Double, duration: Double) {
        clock = LyricsClock(playing: playing, position: position, rate: rate, duration: duration)
        drawnAt = nil
        drawFrame()
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
            say("the switch is off: the TV mirrors the phone")
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

    /// The lyrics up on the TV. iOS stops mirroring while the window is up.
    private func show() {
        guard window == nil, let scene else { return }
        let made = UIWindow(windowScene: scene)
        let root = UIViewController()
        root.view.backgroundColor = .black
        let picture = UIView(frame: root.view.bounds)
        picture.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        picture.backgroundColor = .black
        picture.layer.contentsGravity = .resizeAspect
        root.view.addSubview(picture)
        made.rootViewController = root
        made.isHidden = false
        let renderer = LyricsWindowRenderer(width: Self.pixelWidth, height: Self.pixelHeight)
        renderer.trouble = { [weak self] trouble in
            self?.say("could not draw for the TV: \(trouble)")
        }
        window = made
        self.picture = picture
        self.renderer = renderer
        drawnAt = nil
        imageFailed = false
        drawFrame()
        let link = CADisplayLink(target: self, selector: #selector(tick))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 15, maximum: 30, preferred: 30)
        link.add(to: .main, forMode: .common)
        self.link = link
        say("the lyrics are on the TV, in place of the phone")
    }

    /// The window gone, so iOS mirrors the phone again.
    private func hide() {
        link?.invalidate()
        link = nil
        guard let window else { return }
        window.isHidden = true
        self.window = nil
        picture = nil
        renderer = nil
        say("the lyrics left the TV; it mirrors the phone again")
    }

    private func tell() {
        changed(connected, showing)
    }

    // MARK: - Frames

    @objc private func tick() {
        drawFrame()
    }

    /// A frame of now, unless the last one already is: a paused song is
    /// drawn once, not thirty times a second.
    private func drawFrame() {
        guard let picture, let renderer else { return }
        let time = clock.time()
        if let drawnAt, drawnAt == time { return }
        guard let pixels = renderer.draw(script ?? Self.idle, at: time) else { return }
        var image: CGImage?
        let status = VTCreateCGImageFromCVPixelBuffer(pixels, options: nil, imageOut: &image)
        guard status == noErr, let image else {
            if !imageFailed {
                imageFailed = true
                say("could not draw for the TV: no image from the frame (\(status))")
            }
            return
        }
        picture.layer.contents = image
        drawnAt = time
    }
}
