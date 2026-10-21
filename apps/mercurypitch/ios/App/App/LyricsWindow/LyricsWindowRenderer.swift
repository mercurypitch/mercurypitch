import CoreGraphics
import CoreText
import CoreVideo
import UIKit

// One frame of the lyrics window, as a picture: what Android's window shows
// (src/features/karaoke-room/KaraokeLyricsWindow.tsx, and its styles in
// karaoke-room.module.css). The title small at the top; the line being sung
// big, its words lit as they are sung and the one being sung filling from
// the left; the next line under it, dim. In a rest the coming line takes the
// big place, dimmed, and a song with no lyrics shows its title there. Behind
// it all, the Mercury Pitch picture the lock screen shows, under the same
// dark scrim.
//
// Core Graphics and Core Text only, in the bitmap's own coordinates (origin
// at the bottom left), so a frame needs nothing from UIKit's drawing state.
final class LyricsWindowRenderer {
    /// The lyrics window's frame. Every size below is laid out for this
    /// height and scaled for another, so a TV's frame (TVLyrics.swift) is
    /// the same picture at more pixels.
    static let windowWidth = 640
    static let windowHeight = 360

    /// Something went wrong drawing; said once per kind, for the log.
    var trouble: ((String) -> Void)?

    private let metrics: Metrics

    /// Frames of `width` by `height` pixels: the window's unless told.
    init(width: Int = LyricsWindowRenderer.windowWidth, height: Int = LyricsWindowRenderer.windowHeight) {
        metrics = Metrics(
            width: width,
            height: height,
            scale: CGFloat(height) / CGFloat(LyricsWindowRenderer.windowHeight)
        )
    }

    private var pool: CVPixelBufferPool?
    private lazy var backdrop: CGImage? = makeBackdrop()
    private var troubles = Set<String>()

    /// A frame of the window at `time` seconds into the song.
    func draw(_ script: LyricsWindowScript, at time: Double) -> CVPixelBuffer? {
        guard let pool = bufferPool() else {
            report("no pixel buffer pool")
            return nil
        }
        var made: CVPixelBuffer?
        let status = CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &made)
        guard status == kCVReturnSuccess, let buffer = made else {
            report("no pixel buffer (\(status))")
            return nil
        }
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        guard let context = CGContext(
            data: CVPixelBufferGetBaseAddress(buffer),
            width: metrics.width,
            height: metrics.height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
            space: Self.colorSpace,
            bitmapInfo: Self.bitmapInfo
        ) else {
            report("no drawing context")
            return nil
        }
        let frame = CGRect(x: 0, y: 0, width: metrics.width, height: metrics.height)
        if let backdrop {
            context.draw(backdrop, in: frame)
        } else {
            context.setFillColor(Palette.ground)
            context.fill(frame)
        }
        paintLyrics(script, at: time, in: context)
        return buffer
    }

    // MARK: - The lyrics

    private struct Line {
        let colored: CTLine
        /// The same line all lit, drawn over a word as it fills.
        let lit: CTLine?
        let range: CFRange
        let width: CGFloat
    }

    private struct Sweep {
        let range: NSRange
        let fill: CGFloat
    }

    private struct Block {
        let lines: [Line]
        let font: CTFont
        var sweeps: [Sweep] = []

        var lineHeight: CGFloat { CTFontGetSize(font) * 1.15 }
        var height: CGFloat { lineHeight * CGFloat(lines.count) }
    }

    /// The sizes a frame is laid out with: the window's, scaled to its height.
    private struct Metrics {
        let width: Int
        let height: Int
        let scale: CGFloat

        var textWidth: CGFloat { CGFloat(width) * 0.88 }
        var gap: CGFloat { 6 * scale }
        var lineSizes: [CGFloat] { ([54, 48, 44, 40] as [CGFloat]).map { $0 * scale } }

        func points(_ size: CGFloat) -> CGFloat { size * scale }
    }

    private static let maxLines = 3

    private func paintLyrics(_ script: LyricsWindowScript, at time: Double, in context: CGContext) {
        let segment = script.segment(at: time)
        let current = segment?.current ?? []
        let next = segment?.next

        var blocks: [Block] = []
        if !current.isEmpty || next != nil {
            blocks.append(Self.single(script.title, Self.font(metrics.points(28), .semibold), Palette.title, metrics))
        }
        if let segment, !current.isEmpty {
            blocks.append(Self.sung(segment, at: time, metrics))
            if let next {
                blocks.append(Self.single(next, Self.font(metrics.points(33), .medium), Palette.next, metrics))
            }
        } else if let next {
            blocks.append(Self.big(next, Palette.waiting, metrics))
        } else {
            blocks.append(Self.big(script.title, Palette.lit, metrics))
        }

        let total = blocks.reduce(0) { $0 + $1.height } + metrics.gap * CGFloat(max(0, blocks.count - 1))
        var top = (CGFloat(metrics.height) + total) / 2
        context.textMatrix = .identity
        for block in blocks {
            let ascent = CTFontGetAscent(block.font)
            let descent = CTFontGetDescent(block.font)
            for line in block.lines {
                let baseline = top - (block.lineHeight - ascent - descent) / 2 - ascent
                let x = (CGFloat(metrics.width) - line.width) / 2
                context.textPosition = CGPoint(x: x, y: baseline)
                CTLineDraw(line.colored, context)
                if let lit = line.lit {
                    for sweep in block.sweeps {
                        let start = max(sweep.range.location, line.range.location)
                        let end = min(
                            sweep.range.location + sweep.range.length,
                            line.range.location + line.range.length
                        )
                        guard start < end else { continue }
                        let from = x + CTLineGetOffsetForStringIndex(line.colored, start, nil)
                        let to = x + CTLineGetOffsetForStringIndex(line.colored, end, nil)
                        context.saveGState()
                        context.clip(to: CGRect(
                            x: from,
                            y: top - block.lineHeight,
                            width: max(0, (to - from) * sweep.fill),
                            height: block.lineHeight
                        ))
                        context.textPosition = CGPoint(x: x, y: baseline)
                        CTLineDraw(lit, context)
                        context.restoreGState()
                    }
                }
                top -= block.lineHeight
            }
            top -= metrics.gap
        }
    }

    /// The line being sung: its words lit, filling or dim as at `time`.
    private static func sung(_ segment: LyricsWindowScript.Segment, at time: Double, _ metrics: Metrics) -> Block {
        let words = segment.current
        let text = words.joined(separator: " ")
        var ranges: [NSRange] = []
        var location = 0
        for word in words {
            let length = (word as NSString).length
            ranges.append(NSRange(location: location, length: length))
            location += length + 1
        }
        let fills = words.indices.map { segment.fill(of: $0, at: time) }

        var chosen: Block?
        for size in metrics.lineSizes {
            let font = Self.font(size, .bold)
            let colored = attributed(text, font, Palette.dim)
            var sweeps: [Sweep] = []
            for (index, range) in ranges.enumerated() {
                if fills[index] >= 1 {
                    colored.addAttribute(colorKey, value: Palette.lit, range: range)
                } else if fills[index] > 0 {
                    sweeps.append(Sweep(range: range, fill: CGFloat(fills[index])))
                }
            }
            let lines = wrap(colored, lit: attributed(text, font, Palette.lit), metrics)
            chosen = Block(lines: Array(lines.prefix(maxLines)), font: font, sweeps: sweeps)
            if lines.count <= maxLines { break }
        }
        return chosen ?? Block(lines: [], font: Self.font(metrics.lineSizes[0], .bold))
    }

    /// A line in the big place, with no words lit one by one.
    private static func big(_ text: String, _ color: CGColor, _ metrics: Metrics) -> Block {
        var chosen: Block?
        for size in metrics.lineSizes {
            let font = Self.font(size, .bold)
            let lines = wrap(attributed(text, font, color), lit: nil, metrics)
            chosen = Block(lines: Array(lines.prefix(maxLines)), font: font)
            if lines.count <= maxLines { break }
        }
        return chosen ?? Block(lines: [], font: Self.font(metrics.lineSizes[0], .bold))
    }

    /// One line, cut short with an ellipsis if it is too wide.
    private static func single(_ text: String, _ font: CTFont, _ color: CGColor, _ metrics: Metrics) -> Block {
        var line = CTLineCreateWithAttributedString(attributed(text, font, color) as CFAttributedString)
        if CTLineGetTypographicBounds(line, nil, nil, nil) > Double(metrics.textWidth) {
            let ellipsis = CTLineCreateWithAttributedString(
                attributed("\u{2026}", font, color) as CFAttributedString
            )
            line = CTLineCreateTruncatedLine(line, Double(metrics.textWidth), .end, ellipsis) ?? line
        }
        let width = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
        let range = CFRange(location: 0, length: (text as NSString).length)
        return Block(lines: [Line(colored: line, lit: nil, range: range, width: width)], font: font)
    }

    /// Breaks text into lines that fit, as the window's width allows.
    private static func wrap(_ text: NSAttributedString, lit: NSAttributedString?, _ metrics: Metrics) -> [Line] {
        let typesetter = CTTypesetterCreateWithAttributedString(text as CFAttributedString)
        let litTypesetter = lit.map { CTTypesetterCreateWithAttributedString($0 as CFAttributedString) }
        var lines: [Line] = []
        var start = 0
        while start < text.length {
            let count = CTTypesetterSuggestLineBreak(typesetter, start, Double(metrics.textWidth))
            guard count > 0 else { break }
            let range = CFRange(location: start, length: count)
            let line = CTTypesetterCreateLine(typesetter, range)
            let width = CTLineGetTypographicBounds(line, nil, nil, nil) - CTLineGetTrailingWhitespaceWidth(line)
            lines.append(Line(
                colored: line,
                lit: litTypesetter.map { CTTypesetterCreateLine($0, range) },
                range: range,
                width: CGFloat(width)
            ))
            start += count
        }
        return lines
    }

    // MARK: - Type and colour

    private static let colorKey = NSAttributedString.Key(kCTForegroundColorAttributeName as String)
    private static let fontKey = NSAttributedString.Key(kCTFontAttributeName as String)

    private static func font(_ size: CGFloat, _ weight: UIFont.Weight) -> CTFont {
        UIFont.systemFont(ofSize: size, weight: weight) as CTFont
    }

    private static func attributed(_ text: String, _ font: CTFont, _ color: CGColor) -> NSMutableAttributedString {
        NSMutableAttributedString(string: text, attributes: [fontKey: font, colorKey: color])
    }

    /// The window's colours, as Android's window has them.
    private enum Palette {
        static let ground = CGColor(srgbRed: 13 / 255, green: 17 / 255, blue: 23 / 255, alpha: 1)
        static let scrim = CGColor(srgbRed: 6 / 255, green: 8 / 255, blue: 14 / 255, alpha: 0.74)
        static let lit = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)
        static let dim = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 0.55)
        static let waiting = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 0.6)
        static let next = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 0.62)
        static let title = CGColor(srgbRed: 154 / 255, green: 164 / 255, blue: 178 / 255, alpha: 1)
    }

    // MARK: - Buffers and the picture behind

    private static let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
    private static let bitmapInfo = CGImageAlphaInfo.premultipliedFirst.rawValue
        | CGBitmapInfo.byteOrder32Little.rawValue

    private func bufferPool() -> CVPixelBufferPool? {
        if let pool { return pool }
        let attributes: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: metrics.width,
            kCVPixelBufferHeightKey as String: metrics.height,
            kCVPixelBufferIOSurfacePropertiesKey as String: [String: Any](),
            kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
            kCVPixelBufferCGImageCompatibilityKey as String: true
        ]
        var made: CVPixelBufferPool?
        CVPixelBufferPoolCreate(kCFAllocatorDefault, nil, attributes as CFDictionary, &made)
        pool = made
        return made
    }

    /// The picture and its scrim, drawn once: every frame starts from it.
    private func makeBackdrop() -> CGImage? {
        guard let context = CGContext(
            data: nil,
            width: metrics.width,
            height: metrics.height,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: Self.colorSpace,
            bitmapInfo: Self.bitmapInfo
        ) else { return nil }
        let frame = CGRect(x: 0, y: 0, width: metrics.width, height: metrics.height)
        context.setFillColor(Palette.ground)
        context.fill(frame)
        // The bundle's copy of native-only/now-playing.webp (native-assets.mjs).
        if let url = Bundle.main.url(forResource: "now-playing", withExtension: "webp", subdirectory: "public"),
           let picture = UIImage(contentsOfFile: url.path)?.cgImage {
            let scale = max(
                frame.width / CGFloat(picture.width),
                frame.height / CGFloat(picture.height)
            )
            let size = CGSize(width: CGFloat(picture.width) * scale, height: CGFloat(picture.height) * scale)
            context.interpolationQuality = .high
            context.draw(picture, in: CGRect(
                x: (frame.width - size.width) / 2,
                y: (frame.height - size.height) / 2,
                width: size.width,
                height: size.height
            ))
        } else {
            report("no now-playing picture in the bundle")
        }
        context.setFillColor(Palette.scrim)
        context.fill(frame)
        return context.makeImage()
    }

    private func report(_ what: String) {
        guard troubles.insert(what).inserted else { return }
        trouble?(what)
    }
}
