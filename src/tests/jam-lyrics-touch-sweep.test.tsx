// ============================================================
// Jam lyric sweep works for a finger, not only a mouse
// ============================================================
//
// Owner report (2026-08-17, tablet): with a singer armed, touch-dragging
// across lyric lines "just seems to stuck". Two mechanics: a touch pointer
// is implicitly CAPTURED by the row it lands on, so pointerenter never
// fires on any other row and the range stayed pinned to line one; and with
// no touch-action the browser reclaimed the drag as a scroll pan,
// pointercancel fired, and the sheet had no cancel handling — the anchor
// stayed lit forever. The sweep now grows by hit-testing the pointer's
// coordinates (Piano Night's glissando pattern) and a cancelled pointer
// abandons cleanly.

import { fireEvent, render } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { JamSongLyrics } from '@/components/jam/JamSongLyrics'
import * as jamStore from '@/stores/jam-store'

vi.mock('@/stores/jam-store', () => ({
  assignJamSongLines: vi.fn(),
  jamAssignBrush: () => 'peer-a',
  jamIsHost: () => true,
  jamLineIsMine: () => false,
  jamPeerId: () => 'me',
  jamPeers: () => [],
  jamSong: () => null,
  jamSongParts: () => ({}),
}))
// Children with their own store surface — not under test.
vi.mock('@/components/jam/JamAssignBar', () => ({
  JamAssignBar: () => <div data-testid="stub-assign-bar" />,
}))
vi.mock('@/components/jam/JamLyricsFinder', () => ({
  JamLyricsFinder: () => <div data-testid="stub-finder" />,
}))

// jsdom has no Element.scrollTo; the sheet's auto-centre effect calls it.
beforeAll(() => {
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo
})

const LINES = [
  { text: 'line zero', startSec: 0 },
  { text: 'line one', startSec: 2 },
  { text: 'line two', startSec: 4 },
]

function renderSheet() {
  const utils = render(() => (
    <JamSongLyrics lines={LINES} positionSec={() => 0} showNotes={false} />
  ))
  const rows = Array.from(utils.container.querySelectorAll('[data-line]'))
  expect(rows).toHaveLength(3)
  return { ...utils, rows }
}

/** Point the document hit-test at a specific row, as a finger would. */
function aimAt(row: Element): void {
  document.elementFromPoint = vi.fn().mockReturnValue(row)
}

describe('the lyric sweep under touch', () => {
  it('grows the range from pointer coordinates, not enter events', () => {
    const assign = vi.mocked(jamStore.assignJamSongLines)
    assign.mockClear()
    const { rows } = renderSheet()

    // A move BEFORE any press sweeps nothing.
    aimAt(rows[1]!)
    fireEvent.pointerMove(rows[1]!, { clientX: 10, clientY: 40 })
    expect(assign).not.toHaveBeenCalled()

    // Finger lands on line 0: with touch, every later pointer event
    // retargets HERE (implicit capture) — enter never fires elsewhere.
    fireEvent.pointerDown(rows[0]!, { clientX: 10, clientY: 10 })

    // A move over nothing paintable (the hit-test misses) keeps the range.
    document.elementFromPoint = vi.fn().mockReturnValue(null)
    fireEvent.pointerMove(rows[0]!, { clientX: 10, clientY: 300 })
    // The finger is over line 2 now, but the event target is still row 0.
    aimAt(rows[2]!)
    fireEvent.pointerMove(rows[0]!, { clientX: 10, clientY: 60 })
    fireEvent.pointerUp(document)

    expect(assign).toHaveBeenCalledWith(0, 2, 'peer-a')
  })

  it('abandons a sweep the browser cancels instead of wedging', () => {
    const assign = vi.mocked(jamStore.assignJamSongLines)
    assign.mockClear()
    const { rows, container } = renderSheet()

    fireEvent.pointerDown(rows[0]!, { clientX: 10, clientY: 10 })
    aimAt(rows[1]!)
    fireEvent.pointerMove(rows[0]!, { clientX: 10, clientY: 40 })
    // The UA reclaims the touch (scroll pan) — nothing may be painted,
    // and the preview anchor must clear so the sheet is not stuck.
    fireEvent.pointerCancel(document)
    expect(assign).not.toHaveBeenCalled()
    expect(container.querySelector('[class*="paintPreview"]')).toBeNull()

    // A later stray pointerup must not commit the dead gesture either.
    fireEvent.pointerUp(document)
    expect(assign).not.toHaveBeenCalled()
  })

  it('keeps the browser from panning while the brush is armed', () => {
    // The gesture can only be delivered at all if the armed rows opt out
    // of scroll gestures; this is the CSS half of the fix.
    const css = readFileSync('src/components/jam/JamSongLyrics.module.css', 'utf8') // prettier-ignore
    const paintingRule = css.match(/\.painting\s*\{[^}]*\}/)?.[0] ?? ''
    expect(paintingRule).toContain('touch-action: none')
  })
})
