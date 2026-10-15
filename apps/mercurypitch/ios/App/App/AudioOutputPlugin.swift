import AVFoundation
import AudioSessionKit
import Capacitor
import Foundation
import UIKit

// The phone's sound output, as the page reads it: the system volume, where
// the sound goes (speaker, receiver, headphones, Bluetooth) and the app's own
// audio session. Read on demand (`read`) and sent again on every change
// (`audioOutputChange`): the volume (KVO on outputVolume), the route, a call
// or Siri taking the session, media services restarting, another app's sound
// starting or stopping, and the app coming back to the front. The premium
// rooms show a hint while the volume is down; a test build's Developer screen
// shows all of it, for the moment a room's sound goes quiet on a phone.
//
// Read only, on purpose. Nothing here sets a category, activates the session
// or overrides the route: the app's session is never changed at runtime under
// WebKit's audio (docs/agent/MISTAKES.md, #923), and AudioSessionKit is where
// the one configuration lives. WebKit plays the page from its own process;
// the volume and the route are the phone's, and the category, mode and
// options are the app's own session, which the readout labels as such.
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

    private var volumeWatch: NSKeyValueObservation?
    private var observers: [NSObjectProtocol] = []

    override public func load() {
        // The volume is observable while the app's session is active, which
        // AudioSession.configure() makes it at launch and after a call.
        volumeWatch = AVAudioSession.sharedInstance().observe(\.outputVolume, options: [.new]) { [weak self] _, _ in
            DispatchQueue.main.async {
                self?.changed("volume")
            }
        }
        let watched: [(Notification.Name, String)] = [
            (AVAudioSession.routeChangeNotification, "route"),
            (AVAudioSession.interruptionNotification, "interruption"),
            (AVAudioSession.mediaServicesWereResetNotification, "media services reset"),
            (AVAudioSession.silenceSecondaryAudioHintNotification, "other audio"),
            (UIApplication.didBecomeActiveNotification, "app in front"),
        ]
        let center = NotificationCenter.default
        for (name, reason) in watched {
            observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.changed(reason)
            })
        }
    }

    deinit {
        volumeWatch?.invalidate()
        for observer in observers {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    @objc func read(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(AudioSession.snapshot())
        }
    }

    /// The output as it is now, with what moved it.
    private func changed(_ reason: String) {
        var data = AudioSession.snapshot()
        data["reason"] = reason
        notifyListeners("audioOutputChange", data: data)
    }
}
