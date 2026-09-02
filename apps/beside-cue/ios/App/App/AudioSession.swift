//  Route Beside Cue's sound to the speaker, and keep it there.
//  ============================================================
//
//  Beside Cue had no audio on iOS at all while Android played fine. The
//  web layer was never the reason: `audio/shared-audio-context.ts` lifts
//  the AudioContext inside the tap gesture, handles iOS's 'interrupted'
//  state, and `drivers/sing.ts` reaches the context before the mic await
//  precisely because only the synchronous part of a gesture can resume a
//  suspended context. All of that was already right. What was missing
//  was underneath it: nothing in this app had ever configured
//  AVAudioSession.
//
//  Two separate silences follow from that, and this file answers both.
//
//  AN APP THAT NEVER SETS A CATEGORY GETS `soloAmbient`, which is
//  silenced by the hardware Ring/Silent switch and by screen lock.
//  Android has no equivalent, which is exactly why the two platforms
//  disagreed.
//
//  A WEB PAGE THAT OPENS THE MIC GETS `playAndRecord`, whose default
//  output port is the receiver -- the earpiece -- not the speaker.
//  WebKit sets that category itself when getUserMedia starts and does
//  not ask for `.defaultToSpeaker`. Beside Cue is a singing game: the
//  mic is open for most of every session, so playback spends most of its
//  life coming out of a speaker held nowhere near the player's ear. That
//  reads as "no audio", not as "quiet audio".
//
//  Both were written down before any of this shipped:
//  docs/plans/mobile-native/capacitor-readiness.md rows B2 and B3 name
//  the earpiece routing and the cold session, and propose a plugin or "a
//  10-line AppDelegate patch". Neither was ever implemented -- grep for
//  AVAudioSession across the repo before this commit and the only hits
//  are those two planning documents.
//
//  Why re-apply on route change rather than set it once. WebKit owns
//  this session too and reconfigures it whenever capture starts or stops
//  (the long-running upstream issue is WebKit bug 167788, WKWebView
//  ignoring the app's category). A one-shot setter at launch is
//  therefore correct until the first time the player sings, and wrong
//  afterwards -- which is the whole app. Watching the route notification
//  is what makes it stick.
//
//  Everything here is best-effort on purpose. A phone that refuses a
//  category should end up with the audio it would have had anyway, never
//  with a crash on launch.

import AVFoundation
import Foundation

enum AudioSession {
    /// Category, mode and options as one decision, so re-applying is the
    /// same call as applying.
    ///
    /// `playAndRecord` rather than `playback` because the mic is core to
    /// the app; `.defaultToSpeaker` is the half that actually fixes the
    /// earpiece; `.allowBluetoothA2DP` so headphones and speakers still
    /// win when they are connected; `.mixWithOthers` so a player humming
    /// along to their own music is not silenced by us.
    private static func apply() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(
                .playAndRecord,
                mode: .default,
                options: [.defaultToSpeaker, .allowBluetoothA2DP, .mixWithOthers]
            )
        } catch {
            NSLog("[AudioSession] setCategory failed: \(error.localizedDescription)")
        }
    }

    /// Force the speaker unless something better is plugged in.
    ///
    /// `.defaultToSpeaker` in the category covers the built-in case, but
    /// the override is what survives WebKit reconfiguring the session
    /// mid-session. Skipped entirely when the current route is a
    /// headset, a car, or anything else the player chose on purpose --
    /// overriding those would be worse than the bug.
    private static func preferSpeaker() {
        let session = AVAudioSession.sharedInstance()
        let chosenElsewhere: Set<AVAudioSession.Port> = [
            .headphones, .bluetoothA2DP, .bluetoothLE, .bluetoothHFP,
            .carAudio, .airPlay, .usbAudio, .headsetMic,
        ]
        let routed = session.currentRoute.outputs.map(\.portType)
        if routed.contains(where: { chosenElsewhere.contains($0) }) { return }
        do {
            try session.overrideOutputAudioPort(.speaker)
        } catch {
            NSLog("[AudioSession] overrideOutputAudioPort failed: \(error.localizedDescription)")
        }
    }

    /// Called once from `AppDelegate`.
    static func configure() {
        apply()
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setActive(true)
        } catch {
            NSLog("[AudioSession] setActive failed: \(error.localizedDescription)")
        }
        preferSpeaker()

        NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: nil,
            queue: .main
        ) { _ in
            // WebKit may have replaced the category on its way here --
            // getUserMedia starting is itself a route change -- so
            // re-assert both halves, not just the override.
            apply()
            preferSpeaker()
        }

        // A phone call or Siri deactivates the session; iOS does not put
        // it back. The web layer already handles the AudioContext going
        // to 'interrupted', but the context resuming into a deactivated
        // session is still silence.
        NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: nil,
            queue: .main
        ) { note in
            let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            guard let raw, AVAudioSession.InterruptionType(rawValue: raw) == .ended else { return }
            do {
                try AVAudioSession.sharedInstance().setActive(true)
            } catch {
                NSLog("[AudioSession] reactivate failed: \(error.localizedDescription)")
            }
            preferSpeaker()
        }
    }

    /// What the session actually is right now, for the dev readout.
    static func describe() -> String {
        let session = AVAudioSession.sharedInstance()
        let outputs = session.currentRoute.outputs.map(\.portType.rawValue).joined(separator: ",")
        return "category=\(session.category.rawValue) mode=\(session.mode.rawValue) out=\(outputs.isEmpty ? "none" : outputs)"
    }
}
