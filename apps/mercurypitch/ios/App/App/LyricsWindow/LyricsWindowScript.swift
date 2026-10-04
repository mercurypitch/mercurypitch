import Foundation

// The song's lyrics worked out ahead, as the page sends them
// (src/lib/lyric-window-script.ts): which line is being sung from when, the
// line after it, and when each of its words fills. Times are seconds into
// the song. The window is drawn from this and the song's clock alone, so it
// keeps time while the page sits hidden behind another app.
struct LyricsWindowScript: Decodable {
    struct Segment: Decodable {
        /// When this stretch starts; it runs until the next one's `at`.
        let at: Double
        /// The words of the line being sung; none in a rest or the intro.
        let current: [String]
        /// The next line with words, or nil after the last.
        let next: String?
        /// Per word of `current`: when it starts to fill, and when it is lit.
        let words: [[Double]]

        /// How lit word `index` is at `time`: 0 dim, 1 lit, between filling.
        func fill(of index: Int, at time: Double) -> Double {
            guard index < words.count, words[index].count == 2 else { return 1 }
            let start = words[index][0]
            let end = words[index][1]
            if time >= end { return 1 }
            if time <= start || end <= start { return 0 }
            return (time - start) / (end - start)
        }
    }

    let title: String
    /// The song's length, 0 while it is not known.
    let duration: Double
    /// In song order, the first at 0.
    let segments: [Segment]

    /// The stretch running at `time`: the last one that has begun.
    func segment(at time: Double) -> Segment? {
        var low = 0
        var high = segments.count - 1
        var found: Int?
        while low <= high {
            let middle = (low + high) / 2
            if segments[middle].at <= time {
                found = middle
                low = middle + 1
            } else {
                high = middle - 1
            }
        }
        return found.map { segments[$0] } ?? segments.first
    }
}
