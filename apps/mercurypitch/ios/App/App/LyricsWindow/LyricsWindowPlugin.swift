import AVKit
import Capacitor
import Foundation
import UIKit

// The Karaoke room's lyrics window on iOS, as the page reaches it: the
// `PictureInPicture` plugin, the name Android's window answers to as well
// (packages/mobile-runtime/src/platform.ts). The page turns auto-enter on
// while a song plays, hands over the song's lyrics worked out ahead, and
// sends the clock with every Now Playing report. Back go the window opening
// and closing, its play and pause, and its log. It also says what iOS does
// to the app's sound (`audioSessionLog`, AudioSessionWatch below).
//
// An app's own plugin is not on Capacitor's package list, so
// ViewController.capacitorDidLoad() registers this one.
@objc(LyricsWindowPlugin)
public class LyricsWindowPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LyricsWindowPlugin"
    public let jsName = "PictureInPicture"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setAutoEnter", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setLyrics", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setClock", returnType: CAPPluginReturnPromise)
    ]

    private var window: LyricsWindow?
    private var sessionWatch: AudioSessionWatch?

    override public func load() {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            let window = LyricsWindow { [weak self] in
                self?.bridge?.viewController?.view.window
            }
            window.say = { [weak self] message in
                self?.log(message)
            }
            window.changed = { [weak self] inWindow in
                self?.notifyListeners("pictureInPictureChange", data: ["inPictureInPicture": inWindow])
            }
            window.pressed = { [weak self] action in
                // When, so the page can tell a press that waited for it while
                // iOS froze the app, and whether another app's sound plays,
                // which a play from here has to take.
                self?.notifyListeners("pictureInPictureAction", data: [
                    "action": action,
                    "at": Date().timeIntervalSince1970 * 1000,
                    "otherAudio": AVAudioSession.sharedInstance().isOtherAudioPlaying
                ])
            }
            self.window = window
            self.sessionWatch = AudioSessionWatch { [weak self] message in
                self?.sessionLog(message)
            }
            let supported = AVPictureInPictureController.isPictureInPictureSupported()
            self.log("loaded; this phone \(supported ? "has" : "has no") picture in picture")
        }
    }

    @objc func setAutoEnter(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        DispatchQueue.main.async { [weak self] in
            self?.window?.setAutoEnter(enabled)
            call.resolve()
        }
    }

    @objc func setLyrics(_ call: CAPPluginCall) {
        let json = call.getString("json")
        DispatchQueue.main.async { [weak self] in
            guard let self else {
                call.resolve()
                return
            }
            guard let json else {
                self.window?.setScript(nil)
                call.resolve()
                return
            }
            do {
                let script = try JSONDecoder().decode(LyricsWindowScript.self, from: Data(json.utf8))
                self.window?.setScript(script)
                call.resolve()
            } catch {
                self.log("could not read the lyrics: \(error.localizedDescription)")
                call.reject("could not read the lyrics")
            }
        }
    }

    @objc func setClock(_ call: CAPPluginCall) {
        let playing = call.getBool("playing") ?? false
        let position = call.getDouble("position") ?? 0
        let rate = call.getDouble("rate") ?? 1
        let duration = call.getDouble("duration") ?? 0
        let interrupted = call.getBool("interrupted") ?? false
        DispatchQueue.main.async { [weak self] in
            self?.window?.setClock(
                playing: playing,
                position: position,
                rate: rate,
                duration: duration,
                interrupted: interrupted
            )
            call.resolve()
        }
    }

    /// To the page's console, kept until the page listens, and to Xcode's.
    private func log(_ message: String) {
        NSLog("[lyrics window] %@", message)
        notifyListeners("pictureInPictureLog", data: ["message": message], retainUntilConsumed: true)
    }

    /// As `log`, under `[audio session]`, with the time iOS said it: a line
    /// kept for a page that was not listening yet reaches it later.
    private func sessionLog(_ message: String) {
        let line = "\(LyricsWindowPlugin.clock.string(from: Date())) \(message)"
        NSLog("[audio session] %@", line)
        notifyListeners("audioSessionLog", data: ["message": line], retainUntilConsumed: true)
    }

    private static let clock: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "HH:mm:ss.SSS"
        return formatter
    }()
}

/// What iOS does to the app's sound, in words, for a device test: another
/// app's sound starting and stopping over ours, a call taking the session
/// and giving it back, the route changing, and what plays elsewhere as the
/// app comes and goes. WebKit plays the page from its own process, whose
/// session this cannot see; the app's session hears the same other app at
/// the same moment (docs/plans/mobile-native/ios-audio-handoff.md).
final class AudioSessionWatch {
    private let say: (String) -> Void
    private var observers: [NSObjectProtocol] = []

    init(say: @escaping (String) -> Void) {
        self.say = say
        let center = NotificationCenter.default
        observers.append(center.addObserver(
            forName: AVAudioSession.silenceSecondaryAudioHintNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            self?.otherAppChanged(note)
        })
        observers.append(center.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            self?.interrupted(note)
        })
        observers.append(center.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            self?.routeChanged(note)
        })
        observers.append(center.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.say("app in front; \(AudioSessionWatch.now())")
        })
        observers.append(center.addObserver(
            forName: UIApplication.willResignActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.say("app leaving; \(AudioSessionWatch.now())")
        })
        say("watching; \(AudioSessionWatch.now())")
    }

    deinit {
        for observer in observers {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    /// The session as it stands: whether another app is playing, the hint
    /// iOS gives to fall silent for it, the category and where sound goes.
    static func now() -> String {
        let session = AVAudioSession.sharedInstance()
        let outputs = session.currentRoute.outputs.map(\.portType.rawValue).joined(separator: ",")
        let other = session.isOtherAudioPlaying ? "playing" : "quiet"
        let hint = session.secondaryAudioShouldBeSilencedHint ? "on" : "off"
        let out = outputs.isEmpty ? "none" : outputs
        return "other audio \(other), silence hint \(hint), category \(session.category.rawValue), out \(out)"
    }

    private func otherAppChanged(_ note: Notification) {
        let raw = note.userInfo?[AVAudioSessionSilenceSecondaryAudioHintTypeKey] as? UInt
        let type = raw.flatMap { AVAudioSession.SilenceSecondaryAudioHintType(rawValue: $0) }
        switch type {
        case .begin:
            say("another app's sound started; \(AudioSessionWatch.now())")
        case .end:
            say("another app's sound stopped; \(AudioSessionWatch.now())")
        default:
            say("another app's sound changed (\(raw.map { String($0) } ?? "no type")); \(AudioSessionWatch.now())")
        }
    }

    private func interrupted(_ note: Notification) {
        let info = note.userInfo ?? [:]
        let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt
        let type = raw.flatMap { AVAudioSession.InterruptionType(rawValue: $0) }
        switch type {
        case .began:
            let rawReason = info[AVAudioSessionInterruptionReasonKey] as? UInt
            let reason = rawReason.flatMap { AVAudioSession.InterruptionReason(rawValue: $0) }
            let why: String
            switch reason {
            case .default:
                why = "another session"
            default:
                why = "reason \(rawReason.map { String($0) } ?? "none")"
            }
            say("interruption began, \(why); \(AudioSessionWatch.now())")
        case .ended:
            let rawOptions = info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            let resume = AVAudioSession.InterruptionOptions(rawValue: rawOptions).contains(.shouldResume)
            say("interruption ended, \(resume ? "may resume" : "no word to resume"); \(AudioSessionWatch.now())")
        default:
            say("interruption (\(raw.map { String($0) } ?? "no type")); \(AudioSessionWatch.now())")
        }
    }

    private func routeChanged(_ note: Notification) {
        let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
        let reason = raw.flatMap { AVAudioSession.RouteChangeReason(rawValue: $0) }
        let why: String
        switch reason {
        case .newDeviceAvailable: why = "a new device"
        case .oldDeviceUnavailable: why = "a device went away"
        case .categoryChange: why = "category change"
        case .override: why = "override"
        case .wakeFromSleep: why = "wake from sleep"
        case .noSuitableRouteForCategory: why = "no route for the category"
        case .routeConfigurationChange: why = "configuration change"
        default: why = "reason \(raw.map { String($0) } ?? "none")"
        }
        say("route changed, \(why); \(AudioSessionWatch.now())")
    }
}
