// ============================================================
// A jam note pill reports how the note is going
// ============================================================
//
// Singers could not tell whether they had hit a note: the pill was
// drawn in the lane's colour whatever came out of the mic, and the
// trail was plotted from the ROUNDED semitone, so a quarter-tone flat
// and dead-on drew the same picture on the same row.
//
// This drives the lane's draw loop through a recording 2D context and
// reads back what it painted. It pins three things: the pill takes a
// green, amber or red cast from how the note is actually going, the
// trail moves when the pitch moves by less than a semitone, and the
// pill is drawn as a share of the row it sits on rather than at a
// constant pixel height -- the pill used to be 9px tall in a lane that
// gave a semitone three, so singing a whole tone flat still drew the
// trail INSIDE the target and looked correct.

import { render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JamPeerLanes } from '@/components/jam/JamPeerLanes'
import { JAM_PILL_SEMITONE_CAP, JAM_ZOOM_MAX, JAM_ZOOM_MIN, } from '@/lib/jam/jam-lane-zoom'
import { JAM_BAND_MIN_SPAN, JAM_QUALITY_COLOR } from '@/lib/jam/jam-pitch-view'
import { setJamLaneZoom } from '@/lib/jam/jam-view-prefs'
import type { JamSongNote } from '@/lib/jam/types'
import { setJamPeers, setJamPitchHistory, setJamSong, setJamSongParts, } from '@/stores/jam-store'

const ME = 'me-peer'
const NOTE_MIDI = 60
const NOTE: JamSongNote[] = [{ midi: NOTE_MIDI, startSec: 0, endSec: 4 }]

interface Painted {
  /** Fill colours used for a rounded rect, in paint order. */
  pills: string[]
  /** Heights of those same rects, in the same order. */
  pillHeights: number[]
  /** Y coordinates the trail was moved or lined to. */
  trailYs: number[]
}

function recordingContext(): { ctx: unknown; painted: Painted } {
  const painted: Painted = { pills: [], pillHeights: [], trailYs: [] }
  const noop = (): void => {}
  let pendingPill = false
  let pendingHeight = 0
  const ctx = {
    canvas: null as unknown,
    setTransform: noop,
    clearRect: noop,
    fillRect: noop,
    beginPath: () => {
      pendingPill = false
    },
    roundRect: (_x: number, _y: number, _w: number, h: number) => {
      pendingPill = true
      pendingHeight = h
    },
    moveTo: (_x: number, y: number) => {
      painted.trailYs.push(y)
    },
    lineTo: (_x: number, y: number) => {
      painted.trailYs.push(y)
    },
    stroke: noop,
    fill: () => {
      if (pendingPill) {
        painted.pills.push(String(ctx.fillStyle))
        painted.pillHeights.push(pendingHeight)
      }
      pendingPill = false
    },
    closePath: noop,
    arc: noop,
    fillText: noop,
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    rect: noop,
    setLineDash: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 10 }) as TextMetrics,
    fillStyle: '' as string | object,
    strokeStyle: '',
    lineWidth: 1,
    lineJoin: '',
    lineCap: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    globalAlpha: 1,
  }
  return { ctx, painted }
}

/** rgba(r,g,b,a) -> the three channels, so a cast can be compared. */
function channels(rgba: string): [number, number, number] | null {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgba)
  if (m === null) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function hexChannels(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

/** How far a painted colour sits from a target colour. */
function distance(rgba: string, hex: string): number {
  const a = channels(rgba)
  if (a === null) return Number.POSITIVE_INFINITY
  const b = hexChannels(hex)
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/**
 * Sing `cents` off the target for a while and hand back what the lane
 * painted on the last frame.
 */
function sing(
  options: { cents: number | null; frames: number; zoom?: number } = {
    cents: 0,
    frames: 12,
  },
): Painted {
  setJamLaneZoom(options.zoom ?? JAM_ZOOM_MIN)
  const { ctx, painted } = recordingContext()
  const frames: (() => void)[] = []
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    frames.push(cb)
    return frames.length
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((
    contextId: string,
  ) =>
    contextId === '2d'
      ? (ctx as CanvasRenderingContext2D)
      : null) as typeof HTMLCanvasElement.prototype.getContext)

  render(() => (
    <JamPeerLanes
      myPeerId={() => ME}
      notes={() => NOTE}
      positionSec={() => 1}
    />
  ))

  for (let i = 0; i < options.frames; i++) {
    if (options.cents !== null) {
      setJamPitchHistory({
        [ME]: [
          {
            frequency: 261.63,
            noteName: 'C',
            cents: options.cents,
            clarity: 0.9,
            midi: NOTE_MIDI,
            timestamp: Date.now(),
          },
        ],
      })
    }
    painted.pills.length = 0
    painted.pillHeights.length = 0
    painted.trailYs.length = 0
    const next = frames.shift()
    next?.()
  }
  return painted
}

describe('jam note pill feedback', () => {
  beforeEach(() => {
    setJamPeers([])
    setJamSong(null)
    setJamSongParts({})
    setJamPitchHistory({})
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(72)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    setJamPitchHistory({})
    setJamLaneZoom(JAM_ZOOM_MIN)
  })

  it('casts the pill green when the note is held', () => {
    const painted = sing({ cents: 5, frames: 12 })
    expect(painted.pills.length).toBeGreaterThan(0)
    const pill = painted.pills[0]!
    expect(distance(pill, JAM_QUALITY_COLOR.perfect)).toBeLessThan(
      distance(pill, JAM_QUALITY_COLOR.miss),
    )
  })

  it('casts the pill amber when the singer is drifting', () => {
    const painted = sing({ cents: 40, frames: 12 })
    const pill = painted.pills[0]!
    expect(distance(pill, JAM_QUALITY_COLOR.close)).toBeLessThan(
      distance(pill, JAM_QUALITY_COLOR.perfect),
    )
    expect(distance(pill, JAM_QUALITY_COLOR.close)).toBeLessThan(
      distance(pill, JAM_QUALITY_COLOR.miss),
    )
  })

  it('casts the pill red on a wrong note', () => {
    const painted = sing({ cents: -180, frames: 12 })
    const pill = painted.pills[0]!
    expect(distance(pill, JAM_QUALITY_COLOR.miss)).toBeLessThan(
      distance(pill, JAM_QUALITY_COLOR.perfect),
    )
  })

  it('casts the pill red when nobody sings it at all', () => {
    // Silence under a target is the case a singer most needs to see.
    const painted = sing({ cents: null, frames: 12 })
    const pill = painted.pills[0]!
    expect(distance(pill, JAM_QUALITY_COLOR.miss)).toBeLessThan(
      distance(pill, JAM_QUALITY_COLOR.perfect),
    )
  })

  it('moves the trail for a drift of less than a semitone', () => {
    // The regression: both of these rounded to MIDI 60 and drew on the
    // same row, so a singer could not see themselves going flat.
    // The last point plotted is the newest sample; the earlier ones are
    // the lane's own centre line and the "now" cursor.
    const onNote = sing({ cents: 0, frames: 6 }).trailYs.at(-1)
    const flat = sing({ cents: -45, frames: 6 }).trailYs.at(-1)
    expect(onNote).toBeDefined()
    expect(flat).toBeDefined()
    expect(Math.abs(onNote! - flat!)).toBeGreaterThan(1)
  })
})

// The lane the mocks describe is the SMALLEST the layout allows: 72px
// tall, which is the `min-height` a lane falls to in a full room. A
// ten-semitone band there is 7.2px a row, so this block is the worst
// case on purpose -- anywhere with more room, the pill is taller.
const LANE_H = 72
const PX_PER_SEMITONE = LANE_H / JAM_BAND_MIN_SPAN

describe('how tall the pill is drawn', () => {
  beforeEach(() => {
    setJamPeers([])
    setJamSong(null)
    setJamSongParts({})
    setJamPitchHistory({})
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(
      LANE_H,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    setJamPitchHistory({})
    setJamLaneZoom(JAM_ZOOM_MIN)
  })

  it('never paints over the semitone next door', () => {
    // The whole reason the verdict colours exist. A pill taller than its
    // own row makes a perfect note and a near miss the same picture, and
    // the trail then runs inside a target it is not actually hitting.
    const height = sing({ cents: 5, frames: 12 }).pillHeights[0]
    expect(height).toBeDefined()
    expect(height!).toBeLessThanOrEqual(
      PX_PER_SEMITONE * JAM_PILL_SEMITONE_CAP + 1e-6,
    )
  })

  it('grows when the singer zooms in', () => {
    // Zooming tightens the band as well as the timeline, so the same
    // lane gives a semitone more pixels and the pill takes them.
    const near = sing({ cents: 5, frames: 12, zoom: JAM_ZOOM_MAX })
      .pillHeights[0]
    const far = sing({ cents: 5, frames: 12, zoom: JAM_ZOOM_MIN })
      .pillHeights[0]
    expect(near).toBeDefined()
    expect(far).toBeDefined()
    expect(near!).toBeGreaterThan(far!)
  })

  it('still says the verdict in height, not only in colour', () => {
    // For anyone who cannot tell the green from the amber.
    const held = sing({ cents: 5, frames: 12 }).pillHeights[0]
    const missed = sing({ cents: -180, frames: 12 }).pillHeights[0]
    expect(held).toBeDefined()
    expect(missed).toBeDefined()
    expect(held!).toBeGreaterThan(missed!)
  })

  it('stays thick enough to see at all', () => {
    const missed = sing({ cents: -180, frames: 12 }).pillHeights[0]
    expect(missed!).toBeGreaterThanOrEqual(2)
  })
})
