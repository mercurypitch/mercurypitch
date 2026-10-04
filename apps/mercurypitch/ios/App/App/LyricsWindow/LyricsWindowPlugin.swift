import AVKit
import Capacitor
import Foundation

// The Karaoke room's lyrics window on iOS, as the page reaches it: the
// `PictureInPicture` plugin, the name Android's window answers to as well
// (packages/mobile-runtime/src/platform.ts). The page turns auto-enter on
// while a song plays, hands over the song's lyrics worked out ahead, and
// sends the clock with every Now Playing report. Back go the window opening
// and closing, its play and pause, and its log.
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
                self?.notifyListeners("pictureInPictureAction", data: ["action": action])
            }
            self.window = window
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
        DispatchQueue.main.async { [weak self] in
            self?.window?.setClock(playing: playing, position: position, rate: rate, duration: duration)
            call.resolve()
        }
    }

    /// To the page's console, kept until the page listens, and to Xcode's.
    private func log(_ message: String) {
        NSLog("[lyrics window] %@", message)
        notifyListeners("pictureInPictureLog", data: ["message": message], retainUntilConsumed: true)
    }
}
