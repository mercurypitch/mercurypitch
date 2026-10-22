import AVFoundation
import AudioSessionKit
import Capacitor
import Foundation
import MediaPlayer
import UIKit

// The phone's sound output, as the page reads it: the system volume, where
// the sound goes (speaker, receiver, headphones, Bluetooth, AirPlay, HDMI)
// and the app's own audio session. Read on demand (`read`) and sent again on
// every change (`audioOutputChange`): the volume (KVO on outputVolume, and
// the volume view below), the route and iOS's reason for moving it, a call
// or Siri taking the session and giving it back, media services restarting,
// another app's sound starting or stopping, and the app coming back to the
// front. A new route goes out under `audioRouteChange` as well, which costs
// nothing to listen to between changes: the latency offset follows it. The
// premium rooms show a hint while the volume is down; a test build's
// Developer screen shows all of it, for the moment a room's sound goes quiet
// on a phone.
//
// Read only, on purpose. Nothing here sets a category, activates the session
// or overrides the route: the app's session is never changed at runtime under
// WebKit's audio (docs/agent/MISTAKES.md, #923), and AudioSessionKit is where
// the one configuration lives. WebKit plays the page from its own process;
// the volume and the route are the phone's, and the category, mode and
// options are the app's own session, which the readout labels as such.
//
// TWO VOLUMES, because one of them stops. outputVolume is the app's own
// session's. On the owner's iPhone it followed the keys after a fresh launch,
// stopped the moment a room opened, and read the same number until the app
// was killed (build 880, 16 Oct). A room's sound plays from WebKit's own
// session, in WebKit's GPU process, and opening the mic switches that one to
// play-and-record, which "will switch to the VC level", a volume of its own
// (WebKit bug 236219). iOS also ends the app's session on a suspension
// without saying it came back. Either way the keys can move a volume the
// app's session no longer reports.
//
// The second reading is MediaPlayer's volume slider, the system volume the
// keys move, off a volume view nobody sees: hidden, so iOS still shows its
// own volume indicator, and read, never moved, since moving it would change
// the phone's volume. Developers report that a volume view outside a window
// reads 0 and never moves, so its reading counts (systemVolumeLive) only once
// it has been seen to move. Until then the page goes by outputVolume, and
// believes it only where the view, settled in its window for a second
// (systemVolumeSettled), reads the same: a view reads 0 until it fills.
// The slider has no event, so it is looked at, and only while that is
// needed: see lookWhileNeeded().
//
// AN INTERRUPTION SAYS WHAT KIND IT WAS where iOS does, by its reason
// (AVAudioSessionInterruptionReasonKey), and the app's state as it arrived
// goes with it: one that came while the app was suspended is delivered only
// as the app runs again. AVAudioSessionInterruptionWasSuspendedKey is not
// read: iOS 14.5 deprecated it as "No longer supported".
//
// An app's own plugin is not on Capacitor's package list, so
// ViewController.capacitorDidLoad() registers this one.
@objc(AudioOutputPlugin)
public class AudioOutputPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioOutputPlugin"
    public let jsName = "AudioOutput"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise)
    ]

    /// How often the volume view's slider is looked at.
    private static let systemVolumeEvery: DispatchTimeInterval = .milliseconds(250)
    /// A volume view fills its slider a moment after it reaches a window: a
    /// change sooner than this, in seconds, is that, not a key.
    private static let systemVolumeSettle: TimeInterval = 1

    private var volumeWatch: NSKeyValueObservation?
    private var observers: [NSObjectProtocol] = []
    private var volumeView: MPVolumeView?
    private var systemVolumeTimer: DispatchSourceTimer?
    private var inWindowSince: Date?
    private var lastSystemVolume: Float?
    private var systemVolumeMoved = false
    private var interrupted = false
    private var lastInterruption: String?

    override public func load() {
        // The volume is observable while the app's session is active.
        // AudioSession.configure() makes it so at launch and after a call,
        // but since iOS 10 the system ends the session whenever it suspends
        // the app, and says so only by an interruption that begins and never
        // ends. Developers report that from then on no change is heard, and
        // that outputVolume can keep the value it had (iOS 18 and later).
        // Nothing here starts the session again (see above): the page reads
        // again while it needs to know (RoomVolumeHint.tsx), and the volume
        // view answers for the system.
        volumeWatch = AVAudioSession.sharedInstance().observe(\.outputVolume, options: [.new]) { [weak self] _, _ in
            DispatchQueue.main.async {
                self?.changed("volume")
            }
        }
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            self?.interruption(note)
        })
        observers.append(center.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] note in
            self?.routeChange(note)
        })
        let watched: [(Notification.Name, String)] = [
            (AVAudioSession.mediaServicesWereResetNotification, "media services reset"),
            (AVAudioSession.silenceSecondaryAudioHintNotification, "other audio"),
            (UIApplication.didBecomeActiveNotification, "app in front"),
        ]
        for (name, reason) in watched {
            observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.changed(reason)
            })
        }
        DispatchQueue.main.async { [weak self] in
            self?.putUpVolumeView()
        }
    }

    deinit {
        volumeWatch?.invalidate()
        systemVolumeTimer?.cancel()
        for observer in observers {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    @objc func read(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            call.resolve(self?.snapshot() ?? AudioSession.snapshot())
        }
    }

    /// The kit's reading of the app's session, with what only this plugin
    /// sees: the system volume, how the app last made its session active,
    /// and the interruptions iOS reported since launch.
    private func snapshot() -> [String: Any] {
        var data = AudioSession.snapshot()
        if let value = systemVolume() {
            data["systemVolume"] = Double(value)
            data["systemVolumeLive"] = systemVolumeMoved
            data["systemVolumeSettled"] = systemVolumeSettled()
        }
        data["activation"] = AudioSession.activation
        data["interrupted"] = interrupted
        if let lastInterruption {
            data["lastInterruption"] = lastInterruption
        }
        return data
    }

    /// The output as it is now, with what moved it. A new route, and the app
    /// back in front with a route that may have moved meanwhile, go out under
    /// an event of their own as well, for a page that follows the route for
    /// as long as the app runs (the latency offset): listening to it keeps
    /// no volume view looked at, which audioOutputChange does (needsLooking).
    private func changed(_ reason: String, _ extra: [String: Any] = [:]) {
        var data = snapshot()
        data["reason"] = reason
        data.merge(extra) { _, new in new }
        notifyListeners("audioOutputChange", data: data)
        if reason == "route" || reason == "app in front" {
            notifyListeners("audioRouteChange", data: data)
        }
    }

    /// A call, Siri or iOS itself taking the app's session, and giving it
    /// back. AVAudioSession has no property that says whether the session is
    /// active; after an interruption that began and has not ended it is not,
    /// so that is kept and sent with every reading.
    private func interruption(_ note: Notification) {
        let info = note.userInfo ?? [:]
        let type = (info[AVAudioSessionInterruptionTypeKey] as? UInt)
            .flatMap { AVAudioSession.InterruptionType(rawValue: $0) }
        let extra: [String: Any] = ["appState": Self.appState()]
        switch type {
        case .began?:
            interrupted = true
            let reason = (info[AVAudioSessionInterruptionReasonKey] as? UInt)
                .map { Self.interruptionReason($0) } ?? "no reason given"
            lastInterruption = "began: \(reason)"
        case .ended?:
            interrupted = false
            let raw = (info[AVAudioSessionInterruptionOptionKey] as? UInt) ?? 0
            let resume = AVAudioSession.InterruptionOptions(rawValue: raw).contains(.shouldResume)
            lastInterruption = resume ? "ended: resume" : "ended"
        default:
            lastInterruption = "of a kind this build does not name"
        }
        changed("interruption", extra)
    }

    private static func interruptionReason(_ raw: UInt) -> String {
        let reason = AVAudioSession.InterruptionReason(rawValue: raw)
        if #available(iOS 17.0, *), reason == .routeDisconnected {
            return "route disconnected"
        }
        switch reason {
        case .default?:
            return "default"
        case .builtInMicMuted?:
            return "built-in mic muted"
        default:
            return "reason \(raw)"
        }
    }

    /// Whether the app was in front as iOS said it: a suspension's
    /// interruption arrives only once the app runs again.
    private static func appState() -> String {
        switch UIApplication.shared.applicationState {
        case .active:
            return "active"
        case .inactive:
            return "inactive"
        case .background:
            return "background"
        @unknown default:
            return "unknown"
        }
    }

    /// A new route, with iOS's reason and the outputs before it, so that a
    /// report says what moved it: a category change, an override, a device.
    private func routeChange(_ note: Notification) {
        let info = note.userInfo ?? [:]
        var extra: [String: Any] = [:]
        if let raw = info[AVAudioSessionRouteChangeReasonKey] as? UInt {
            extra["routeReason"] = Self.routeReason(raw)
        }
        if let before = info[AVAudioSessionRouteChangePreviousRouteKey] as? AVAudioSessionRouteDescription {
            extra["previousOutputs"] = before.outputs.map { $0.portType.rawValue }
        }
        changed("route", extra)
    }

    private static func routeReason(_ raw: UInt) -> String {
        switch AVAudioSession.RouteChangeReason(rawValue: raw) {
        case .newDeviceAvailable?:
            return "new device"
        case .oldDeviceUnavailable?:
            return "device gone"
        case .categoryChange?:
            return "category change"
        case .override?:
            return "override"
        case .wakeFromSleep?:
            return "wake from sleep"
        case .noSuitableRouteForCategory?:
            return "no route for the category"
        case .routeConfigurationChange?:
            return "configuration change"
        case .unknown?:
            return "unknown"
        default:
            return "reason \(raw)"
        }
    }

    /// The volume view, put up once in the web view and hidden: a volume
    /// view reads nothing outside a window, and a hidden one leaves iOS's
    /// own volume indicator alone.
    private func putUpVolumeView() {
        guard volumeView == nil, let host = bridge?.viewController?.view else { return }
        let view = MPVolumeView(frame: CGRect(x: 0, y: 0, width: 1, height: 1))
        view.isHidden = true
        view.isUserInteractionEnabled = false
        view.accessibilityElementsHidden = true
        host.addSubview(view)
        volumeView = view
        startLooking()
    }

    // LOOKED AT ONLY WHILE IT IS NEEDED. The slider has no event, so it is
    // looked at four times a second, and nothing is gained by that while no
    // screen listens: a read answers from the slider as it is. It is looked
    // at from launch until the view has settled in its window and been read
    // once, so that the first room's first reading already says it has
    // settled, and a key pressed before anyone listens still counts as a
    // move on the first look once someone does. After that, only while a
    // screen listens for audioOutputChange: a premium room's volume notice
    // (RoomVolumeHint.tsx), the Developer screen, and a test build's audio
    // record, which listens from launch.

    /// Whether the slider needs looking at now.
    private func needsLooking() -> Bool {
        hasListeners("audioOutputChange") || !systemVolumeSettled() || lastSystemVolume == nil
    }

    /// Looking at the slider, or not, as it is needed. On the main queue.
    private func lookWhileNeeded() {
        if needsLooking() {
            startLooking()
        } else {
            stopLooking()
        }
    }

    private func startLooking() {
        guard systemVolumeTimer == nil, volumeView != nil else { return }
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now(), repeating: Self.systemVolumeEvery, leeway: .milliseconds(50))
        timer.setEventHandler { [weak self] in
            self?.lookAtSystemVolume()
            self?.lookWhileNeeded()
        }
        timer.resume()
        systemVolumeTimer = timer
    }

    private func stopLooking() {
        systemVolumeTimer?.cancel()
        systemVolumeTimer = nil
    }

    // Capacitor calls these on the plugin's own queue, and a reload of the
    // page removes every listener; the timer lives on the main queue.

    override public func addListener(_ call: CAPPluginCall) {
        super.addListener(call)
        DispatchQueue.main.async { [weak self] in
            self?.lookWhileNeeded()
        }
    }

    override public func removeListener(_ call: CAPPluginCall) {
        super.removeListener(call)
        DispatchQueue.main.async { [weak self] in
            self?.lookWhileNeeded()
        }
    }

    override public func removeAllListeners(_ call: CAPPluginCall) {
        super.removeAllListeners(call)
        DispatchQueue.main.async { [weak self] in
            self?.lookWhileNeeded()
        }
    }

    /// The system volume off the volume view's slider: read, never moved.
    private func systemVolume() -> Float? {
        guard let view = volumeView, view.window != nil else { return nil }
        return view.subviews.compactMap { $0 as? UISlider }.first?.value
    }

    /// In its window long enough to have filled its slider.
    private func systemVolumeSettled() -> Bool {
        guard let since = inWindowSince else { return false }
        return Date().timeIntervalSince(since) >= Self.systemVolumeSettle
    }

    /// A change once the view has settled in its window is a key or Control
    /// Center, and proves that the reading follows the system.
    private func lookAtSystemVolume() {
        guard UIApplication.shared.applicationState == .active else { return }
        guard let value = systemVolume() else {
            inWindowSince = nil
            lastSystemVolume = nil
            return
        }
        let since = inWindowSince ?? Date()
        inWindowSince = since
        defer { lastSystemVolume = value }
        guard let last = lastSystemVolume, value != last else { return }
        guard Date().timeIntervalSince(since) >= Self.systemVolumeSettle else { return }
        systemVolumeMoved = true
        if hasListeners("audioOutputChange") {
            changed("system volume")
        }
    }
}
