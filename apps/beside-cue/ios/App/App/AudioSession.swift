//  Route Beside Cue's sound to the speaker without fighting WebKit.
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
//  WebKit owns this session too and can reconfigure it whenever capture
//  starts or stops. Route notifications are therefore useful, but their
//  handler must not fight WebKit for category ownership: setCategory itself
//  produces a category route change, and overrideOutputAudioPort produces an
//  override route change. Unconditionally doing both from every notification
//  creates a feedback loop on the main thread just as media playback starts.
//
//  Everything here is best-effort on purpose. A phone that refuses a
//  category should end up with the audio it would have had anyway, never
//  with a crash on launch.

import AVFoundation
import Foundation

enum AudioSession {
    private static let desiredOptions: AVAudioSession.CategoryOptions = [
        .defaultToSpeaker, .allowBluetoothA2DP, .mixWithOthers,
    ]
    private static var isRoutingToSpeaker = false

    private static func categoryNeedsRepair(_ session: AVAudioSession) -> Bool {
        let hasDesiredOptions =
            session.categoryOptions.intersection(desiredOptions) == desiredOptions
        return session.category != .playAndRecord ||
            session.mode != .default ||
            !hasDesiredOptions
    }

    /// Category, mode and options as one decision. Leave a matching session
    /// alone: changing an already-correct category still emits a route event.
    ///
    /// `playAndRecord` rather than `playback` because the mic is core to
    /// the app; `.defaultToSpeaker` is the half that actually fixes the
    /// earpiece; `.allowBluetoothA2DP` so headphones and speakers still
    /// win when they are connected; `.mixWithOthers` so a player humming
    /// along to their own music is not silenced by us.
    @discardableResult
    private static func applyIfNeeded(_ session: AVAudioSession) -> Bool {
        guard categoryNeedsRepair(session) else { return false }

        do {
            try session.setCategory(
                .playAndRecord,
                mode: .default,
                options: desiredOptions
            )
            return true
        } catch {
            NSLog("[AudioSession] setCategory failed: \(error.localizedDescription)")
            return false
        }
    }

    /// Force the speaker only when iOS actually selected the receiver.
    ///
    /// `.defaultToSpeaker` in the category covers the built-in case, but
    /// the override is what repairs WebKit choosing the earpiece mid-session.
    /// Every non-receiver route is left untouched.
    @discardableResult
    private static func preferSpeakerIfNeeded(_ session: AVAudioSession) -> Bool {
        let receiverSelected = session.currentRoute.outputs.contains {
            $0.portType == .builtInReceiver
        }
        guard receiverSelected else { return false }

        do {
            try session.overrideOutputAudioPort(.speaker)
            return true
        } catch {
            NSLog("[AudioSession] overrideOutputAudioPort failed: \(error.localizedDescription)")
            return false
        }
    }

    /// Reconcile only an actual earpiece route. The guard covers synchronous
    /// delivery; the route check makes delayed notifications no-ops as well.
    private static func routeToSpeakerIfNeeded(
        after reason: AVAudioSession.RouteChangeReason? = nil
    ) {
        guard !isRoutingToSpeaker else { return }
        let session = AVAudioSession.sharedInstance()
        let receiverSelected = session.currentRoute.outputs.contains {
            $0.portType == .builtInReceiver
        }
        guard receiverSelected else { return }

        isRoutingToSpeaker = true
        defer { isRoutingToSpeaker = false }
        let repairedRoute = preferSpeakerIfNeeded(session)
        if repairedRoute {
            let reasonDescription = reason.map { String($0.rawValue) } ?? "launch"
            NSLog(
                "[AudioSession] repaired receiver route after reason=\(reasonDescription): \(describe())"
            )
        }
    }

    /// Called once from `AppDelegate`.
    static func configure() {
        let session = AVAudioSession.sharedInstance()
        applyIfNeeded(session)
        do {
            try session.setActive(true)
        } catch {
            NSLog("[AudioSession] setActive failed: \(error.localizedDescription)")
        }
        routeToSpeakerIfNeeded()

        NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: nil,
            queue: .main
        ) { note in
            let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
            let reason = raw.flatMap {
                AVAudioSession.RouteChangeReason(rawValue: $0)
            }

            // This may be our own `.override` notification. By the time it is
            // delivered the route is the speaker, so the state check is a
            // no-op. If another owner cleared an override to the receiver,
            // the same reason still receives the one repair it needs.
            routeToSpeakerIfNeeded(after: reason)
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
                let session = AVAudioSession.sharedInstance()
                applyIfNeeded(session)
                try session.setActive(true)
            } catch {
                NSLog("[AudioSession] reactivate failed: \(error.localizedDescription)")
            }
            routeToSpeakerIfNeeded()
        }
    }

    /// What the session actually is right now, for the dev readout.
    static func describe() -> String {
        let session = AVAudioSession.sharedInstance()
        let outputs = session.currentRoute.outputs.map(\.portType.rawValue).joined(separator: ",")
        return "category=\(session.category.rawValue) mode=\(session.mode.rawValue) out=\(outputs.isEmpty ? "none" : outputs)"
    }
}
