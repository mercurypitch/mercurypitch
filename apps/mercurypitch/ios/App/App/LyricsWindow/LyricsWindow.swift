import AVFoundation
import AVKit
import AudioSessionKit
import CoreMedia
import UIKit

// The Karaoke room's lyrics in iOS's picture-in-picture window
// (docs/plans/mobile-native/ios-lyrics-window.md).
//
// iOS puts only video in its floating window, so this is a video of the
// lyrics: a sample-buffer layer fed frames the renderer draws from the
// song's lyrics, worked out ahead by the page, and its clock, the lock
// screen's reports run on. The layer sits in the app's window behind the
// web view, where nobody sees it until iOS lifts it out into the window.
//
// THE APP REVIEW RULES (the plan has them in full). The window opens only as
// a video app's does: armed with canStartPictureInPictureAutomaticallyFromInline
// while a song plays in the room, and opened by iOS when the singer swipes
// home. Nothing here starts it. It is disarmed when the song pauses or the
// room goes, and closed when the lyrics are taken away or the app comes back
// to the front.
//
// Every step is said (`say`), and the page writes it to its console as
// `[lyrics window] ...`: on a phone, the only way to see why a window did or
// did not open. Everything here runs on the main thread.
final class LyricsWindow: NSObject {
    /// A line for the log.
    var say: (String) -> Void = { _ in }
    /// The window opening (true), or starting to close (false).
    var changed: (Bool) -> Void = { _ in }
    /// The window's own play ("play") or pause ("pause") pressed.
    var pressed: (String) -> Void = { _ in }

    /// Where the song is: the last report, run on by the host clock.
    private struct Clock {
        var playing = false
        var position: Double = 0
        var rate: Double = 1
        var duration: Double = 0
        /// When the report came, on the host clock.
        var at: Double = CACurrentMediaTime()

        func time(_ now: Double = CACurrentMediaTime()) -> Double {
            let time = position + (playing ? (now - at) * rate : 0)
            return duration > 0 ? min(max(0, time), duration) : max(0, time)
        }
    }

    /// A view whose own layer is the sample-buffer layer, so it keeps its size.
    private final class LayerView: UIView {
        override class var layerClass: AnyClass { AVSampleBufferDisplayLayer.self }
        // swiftlint:disable:next force_cast
        var sampleLayer: AVSampleBufferDisplayLayer { layer as! AVSampleBufferDisplayLayer }
    }

    private let findWindow: () -> UIWindow?
    private let host = LayerView()
    private var layer: AVSampleBufferDisplayLayer { host.sampleLayer }
    private let renderer = LyricsWindowRenderer()

    private var script: LyricsWindowScript?
    private var autoEnter = false
    private var clock = Clock()
    private var open = false
    private var layerFailed = false

    private var timebase: CMTimebase?
    private var controller: AVPictureInPictureController?
    private var possibleWatch: NSKeyValueObservation?
    private var pump: DispatchSourceTimer?
    private var framesPerSecond = 0

    init(findWindow: @escaping () -> UIWindow?) {
        self.findWindow = findWindow
        super.init()
        renderer.trouble = { [weak self] trouble in
            self?.say("could not draw: \(trouble)")
        }
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appLeft),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appCameBack),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
    }

    // MARK: - What the page says

    /// On while a song plays in the room with the window allowed.
    func setAutoEnter(_ on: Bool) {
        guard on != autoEnter else { return }
        autoEnter = on
        say("auto-enter \(on ? "on" : "off")")
        arm()
    }

    /// The song's lyrics, or nil when the room has no song.
    func setScript(_ script: LyricsWindowScript?) {
        self.script = script
        if let script {
            say("lyrics for \(script.segments.count) stretches, \(Int(script.duration)) s")
            if prepare() {
                drawFrame()
                controller?.invalidatePlaybackState()
            }
        } else {
            say("lyrics taken away")
            if controller?.isPictureInPictureActive == true {
                say("closing the window: the song left the room")
                controller?.stopPictureInPicture()
            }
        }
        arm()
    }

    /// A Now Playing report: where the song is now.
    func setClock(playing: Bool, position: Double, rate: Double, duration: Double) {
        clock = Clock(playing: playing, position: position, rate: rate, duration: duration)
        setTimebase()
        controller?.invalidatePlaybackState()
        say(String(
            format: "clock: %@ at %.2f s of %.0f, rate %.2f",
            playing ? "playing" : "paused",
            position,
            duration,
            rate
        ))
        if !open { drawFrame() }
    }

    // MARK: - The layer and the controller

    /// The layer in the app's window and the controller over it, made once.
    private func prepare() -> Bool {
        if controller != nil { return true }
        guard AVPictureInPictureController.isPictureInPictureSupported() else {
            say("this phone has no picture in picture")
            return false
        }
        guard let window = findWindow() else {
            say("no app window to put the lyrics in yet")
            return false
        }
        // A band across the middle of the screen, behind the page: the
        // window grows out of where the lyrics are.
        let bounds = window.bounds
        let height = bounds.width * 9 / 16
        host.frame = CGRect(x: 0, y: (bounds.height - height) / 2, width: bounds.width, height: height)
        host.autoresizingMask = [.flexibleWidth, .flexibleTopMargin, .flexibleBottomMargin]
        host.isUserInteractionEnabled = false
        layer.videoGravity = .resizeAspect
        window.insertSubview(host, at: 0)

        var clockbase: CMTimebase?
        CMTimebaseCreateWithSourceClock(
            allocator: kCFAllocatorDefault,
            sourceClock: CMClockGetHostTimeClock(),
            timebaseOut: &clockbase
        )
        if let clockbase {
            layer.controlTimebase = clockbase
            timebase = clockbase
            setTimebase()
        }

        let source = AVPictureInPictureController.ContentSource(
            sampleBufferDisplayLayer: layer,
            playbackDelegate: self
        )
        let made = AVPictureInPictureController(contentSource: source)
        made.delegate = self
        made.requiresLinearPlayback = true
        possibleWatch = made.observe(\.isPictureInPicturePossible, options: [.new]) { [weak self] watched, _ in
            let possible = watched.isPictureInPicturePossible
            DispatchQueue.main.async {
                self?.say("a window is \(possible ? "possible" : "not possible") now")
            }
        }
        controller = made
        say("ready: the layer is behind the page, \(Int(bounds.width))x\(Int(height)) points")
        return true
    }

    /// Armed while auto-enter is on and there are lyrics; disarmed otherwise.
    private func arm() {
        if autoEnter, script != nil { _ = prepare() }
        guard let controller else {
            runPump()
            return
        }
        let armed = autoEnter && script != nil
        if controller.canStartPictureInPictureAutomaticallyFromInline != armed {
            // A frame in the layer before iOS may lift it out.
            if armed { drawFrame() }
            controller.canStartPictureInPictureAutomaticallyFromInline = armed
            if armed {
                say("armed: swiping home opens the window (possible: \(controller.isPictureInPicturePossible), \(session()))")
            } else {
                say("disarmed: \(script == nil ? "no lyrics" : "the song is not playing, or the setting is off")")
            }
        }
        runPump()
    }

    private func setTimebase() {
        guard let timebase else { return }
        CMTimebaseSetTime(timebase, time: CMTime(seconds: clock.time(), preferredTimescale: 600))
        CMTimebaseSetRate(timebase, rate: clock.playing ? clock.rate : 0)
    }

    // MARK: - Frames

    /// 15 frames a second while the window is up, 2 while it is armed (so it
    /// opens on a frame of now), none otherwise.
    private func runPump() {
        let armed = controller?.canStartPictureInPictureAutomaticallyFromInline == true
        let wanted = open ? 15 : (armed ? 2 : 0)
        guard wanted != framesPerSecond else { return }
        pump?.cancel()
        pump = nil
        framesPerSecond = wanted
        guard wanted > 0 else { return }
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now(), repeating: .milliseconds(1000 / wanted), leeway: .milliseconds(5))
        timer.setEventHandler { [weak self] in
            self?.drawFrame()
        }
        timer.resume()
        pump = timer
    }

    private func drawFrame() {
        guard let script, controller != nil else { return }
        recoverLayer()
        guard let pixels = renderer.draw(script, at: clock.time()),
              let sample = sampleBuffer(pixels) else { return }
        if #available(iOS 17.0, *) {
            layer.sampleBufferRenderer.enqueue(sample)
        } else {
            layer.enqueue(sample)
        }
    }

    /// A layer that failed shows nothing until it is flushed.
    private func recoverLayer() {
        let failed: Bool
        let error: Error?
        if #available(iOS 17.0, *) {
            failed = layer.sampleBufferRenderer.status == .failed
            error = layer.sampleBufferRenderer.error
        } else {
            failed = layer.status == .failed
            error = layer.error
        }
        defer { layerFailed = failed }
        guard failed else { return }
        if !layerFailed {
            let reason = error.map { describe($0) } ?? "no error given"
            say("the layer failed (\(reason)); flushing it")
        }
        if #available(iOS 17.0, *) {
            layer.sampleBufferRenderer.flush()
        } else {
            layer.flush()
        }
    }

    private func sampleBuffer(_ pixels: CVPixelBuffer) -> CMSampleBuffer? {
        var format: CMVideoFormatDescription?
        CMVideoFormatDescriptionCreateForImageBuffer(
            allocator: kCFAllocatorDefault,
            imageBuffer: pixels,
            formatDescriptionOut: &format
        )
        guard let format else {
            say("could not draw: no format description")
            return nil
        }
        let now = timebase.map { CMTimebaseGetTime($0) } ?? CMClockGetTime(CMClockGetHostTimeClock())
        var timing = CMSampleTimingInfo(duration: .invalid, presentationTimeStamp: now, decodeTimeStamp: .invalid)
        var made: CMSampleBuffer?
        CMSampleBufferCreateReadyWithImageBuffer(
            allocator: kCFAllocatorDefault,
            imageBuffer: pixels,
            formatDescription: format,
            sampleTiming: &timing,
            sampleBufferOut: &made
        )
        guard let sample = made else {
            say("could not draw: no sample buffer")
            return nil
        }
        // Shown as it arrives: the frame is drawn for now, not for a time.
        if let attachments = CMSampleBufferGetSampleAttachmentsArray(sample, createIfNecessary: true),
           CFArrayGetCount(attachments) > 0 {
            let first = unsafeBitCast(CFArrayGetValueAtIndex(attachments, 0), to: CFMutableDictionary.self)
            CFDictionarySetValue(
                first,
                Unmanaged.passUnretained(kCMSampleAttachmentKey_DisplayImmediately).toOpaque(),
                Unmanaged.passUnretained(kCFBooleanTrue).toOpaque()
            )
        }
        return sample
    }

    // MARK: - The app coming and going

    @objc private func appLeft() {
        guard let controller else { return }
        say("the app went behind: armed \(controller.canStartPictureInPictureAutomaticallyFromInline), possible \(controller.isPictureInPicturePossible), open \(controller.isPictureInPictureActive)")
    }

    /// Back in front, the room shows the song itself, as a video app's does.
    @objc private func appCameBack() {
        guard let controller, controller.isPictureInPictureActive else { return }
        say("the app is back in front: closing the window")
        controller.stopPictureInPicture()
    }

    private func session() -> String {
        let session = AVAudioSession.sharedInstance()
        return "\(AudioSession.describe()) options=\(session.categoryOptions.rawValue) otherAudio=\(session.isOtherAudioPlaying)"
    }

    private func describe(_ error: Error) -> String {
        let error = error as NSError
        return "\(error.domain) \(error.code): \(error.localizedDescription)"
    }
}

// MARK: - The window's playback

extension LyricsWindow: AVPictureInPictureSampleBufferPlaybackDelegate {
    func pictureInPictureController(_ pictureInPictureController: AVPictureInPictureController, setPlaying playing: Bool) {
        say("\(playing ? "play" : "pause") pressed in the window")
        // Shown at once; the page's next report confirms it.
        clock = Clock(playing: playing, position: clock.time(), rate: clock.rate, duration: clock.duration)
        setTimebase()
        pictureInPictureController.invalidatePlaybackState()
        pressed(playing ? "play" : "pause")
    }

    func pictureInPictureControllerTimeRangeForPlayback(_ pictureInPictureController: AVPictureInPictureController) -> CMTimeRange {
        // Always finite: an endless range has cost 100% CPU since iOS 16.1.
        let known = clock.duration > 0 ? clock.duration : (script?.duration ?? 0)
        let length = known > 0 ? known : 3600
        return CMTimeRange(start: .zero, duration: CMTime(seconds: length, preferredTimescale: 600))
    }

    func pictureInPictureControllerIsPlaybackPaused(_ pictureInPictureController: AVPictureInPictureController) -> Bool {
        !clock.playing
    }

    func pictureInPictureController(
        _ pictureInPictureController: AVPictureInPictureController,
        didTransitionToRenderSize newRenderSize: CMVideoDimensions
    ) {
        say("the window is \(newRenderSize.width)x\(newRenderSize.height)")
    }

    func pictureInPictureController(
        _ pictureInPictureController: AVPictureInPictureController,
        skipByInterval skipInterval: CMTime,
        completion completionHandler: @escaping () -> Void
    ) {
        // No skip buttons (requiresLinearPlayback), so never asked.
        completionHandler()
    }

    func pictureInPictureControllerShouldProhibitBackgroundAudioPlayback(
        _ pictureInPictureController: AVPictureInPictureController
    ) -> Bool {
        // The song plays on behind other apps whether or not a window is up.
        false
    }
}

// MARK: - The window opening and closing

extension LyricsWindow: AVPictureInPictureControllerDelegate {
    func pictureInPictureControllerWillStartPictureInPicture(_ pictureInPictureController: AVPictureInPictureController) {
        say("opening (\(session()))")
        open = true
        runPump()
        changed(true)
    }

    func pictureInPictureControllerDidStartPictureInPicture(_ pictureInPictureController: AVPictureInPictureController) {
        say("open")
    }

    func pictureInPictureController(
        _ pictureInPictureController: AVPictureInPictureController,
        failedToStartPictureInPictureWithError error: Error
    ) {
        say("could not open: \(describe(error))")
        open = false
        changed(false)
        // Armed again for the next swipe home: iOS sometimes refuses one
        // (PGPegasusErrorDomain -1003). It is never started from here.
        pictureInPictureController.canStartPictureInPictureAutomaticallyFromInline = false
        arm()
    }

    func pictureInPictureControllerWillStopPictureInPicture(_ pictureInPictureController: AVPictureInPictureController) {
        // Told now rather than once it is gone, so the room is itself again
        // before the app is on the screen.
        say("closing")
        open = false
        runPump()
        changed(false)
    }

    func pictureInPictureControllerDidStopPictureInPicture(_ pictureInPictureController: AVPictureInPictureController) {
        say("closed")
    }

    func pictureInPictureController(
        _ pictureInPictureController: AVPictureInPictureController,
        restoreUserInterfaceForPictureInPictureStopWithCompletionHandler completionHandler: @escaping (Bool) -> Void
    ) {
        say("back to the app from the window")
        completionHandler(true)
    }
}
