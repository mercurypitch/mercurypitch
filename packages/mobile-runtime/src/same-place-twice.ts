// ============================================================
// The same place twice: the lock screen's counter
// ============================================================
//
// iOS starts the lock screen's counter again only when what it is told
// changes. A second jump to where the bar already was (-10 s at the start,
// the same line tapped twice) left the counter running on from the first:
// the song played from 0:00 while the lock screen counted 0:05 (build 549).
// Nothing on our side drops a repeat, and neither does WebKit
// (NowPlayingManager::setNowPlayingInfo drops only an exactly equal update,
// and the elapsed time it sends counts the time since the report), so it is
// iOS keeping its own clock. MediaRemote is private: that part is inferred.
//
// Such a repeat goes a quarter second on, which shows the same second, a
// hair faster. The next report puts both back.

/** Two places this close are the same one. */
export const SAME_PLACE_S = 0.05
/** How far a repeat goes on: a new place that shows the same second. */
export const REPEAT_NUDGE_S = 0.25
/** And how much faster, which iOS hears as a change too. */
export const REPEAT_RATE = 1.0001
/** A repeat sooner than this is one moment told twice, and needs nothing. */
export const REPEAT_AFTER_MS = 500

/** A report's place for the bar, as the Now Playing module has it. */
export interface BarReport {
  readonly position: number
  readonly rate: number
  readonly duration: number
  readonly playing: boolean
}

/** Where the bar goes, and at what speed. */
export interface BarPlacing {
  readonly position: number
  readonly rate: number
  /** Put on a hair: the report repeated the last place. */
  readonly repeat: boolean
}

export interface SamePlaceTwice {
  /** Where a report puts the bar: a hair on, if it repeats the last place. */
  place: (report: BarReport, at: number) => BarPlacing
  /** WebKit took the placing: the next report is read against it. */
  took: (placing: BarPlacing, playing: boolean, at: number) => void
  /** The song left: nothing to repeat. */
  forget: () => void
}

export function watchTheSamePlace(): SamePlaceTwice {
  let lastAt: number | null = null
  let lastRate = 1
  let lastPutAt = 0

  return {
    place: (report, at) => {
      const { duration, rate } = report
      const position = Math.min(duration, Math.max(0, report.position))
      const repeat =
        report.playing &&
        lastAt !== null &&
        lastRate === rate &&
        Math.abs(position - lastAt) < SAME_PLACE_S &&
        at - lastPutAt >= REPEAT_AFTER_MS
      if (!repeat) return { position, rate, repeat }
      return {
        position:
          position + REPEAT_NUDGE_S <= duration
            ? position + REPEAT_NUDGE_S
            : Math.max(0, position - REPEAT_NUDGE_S),
        rate: rate * REPEAT_RATE,
        repeat,
      }
    },
    took: (placing, playing, at) => {
      // A paused bar does not run, and playing it again is news to iOS.
      lastAt = playing ? placing.position : null
      lastRate = placing.rate
      lastPutAt = at
    },
    forget: () => {
      lastAt = null
      lastRate = 1
      lastPutAt = 0
    },
  }
}
