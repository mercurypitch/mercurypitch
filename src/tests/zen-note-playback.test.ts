import { describe, expect, it } from 'vitest'
import { createZenNoteScheduler, zenToneDurationSec, } from '@/features/zen/note-playback'
import type { ResolvedZenTarget } from '@/features/zen/types'

// ============================================================
// The guide-note scheduler — REQ-ZENP-013..020
// ============================================================
//
// Nothing here touches audio: the scheduler answers "which targets sound at
// this sample", which is the whole of the timing and all of the bugs. See
// docs/specs/zen-exercise-playback.ears.md.

const target = (
  id: string,
  startSec: number,
  endSec: number,
  startMidi = 60,
): ResolvedZenTarget => ({
  id,
  startBeat: startSec,
  durationBeats: endSec - startSec,
  semitone: startMidi - 60,
  cue: 'Ah',
  startSec,
  endSec,
  startMidi,
  endMidi: startMidi,
})

/** Four half-second notes on a two-second lap. */
const PHRASE: ResolvedZenTarget[] = [
  target('a', 0, 0.5, 60),
  target('b', 0.5, 1, 62),
  target('c', 1, 1.5, 64),
  target('d', 1.5, 2, 65),
]

const ids = (cues: { target: ResolvedZenTarget }[]): string[] =>
  cues.map((cue) => cue.target.id)

describe('zen note scheduler', () => {
  // REQ-ZENP-013. The regression this whole file exists for: the old stage
  // derived its lap index from elapsed time, which the session resets at
  // every seam, so the index was permanently 0 and lap two found every
  // target already marked played. Silent from the second pass onward.
  it('sounds every target on every lap, not just the first', () => {
    const scheduler = createZenNoteScheduler()
    const lap = (loopIndex: number): string[] => {
      const heard: string[] = []
      for (let elapsedSec = 0; elapsedSec < 2; elapsedSec += 0.1) {
        heard.push(
          ...ids(
            scheduler.sample({
              elapsedSec: Number(elapsedSec.toFixed(2)),
              loopIndex,
              targets: PHRASE,
            }),
          ),
        )
      }
      return heard
    }

    expect(lap(0)).toEqual(['a', 'b', 'c', 'd'])
    expect(lap(1)).toEqual(['a', 'b', 'c', 'd'])
    expect(lap(2)).toEqual(['a', 'b', 'c', 'd'])
  })

  // REQ-ZENP-014. A sixteenth at tempo is shorter than a heavy frame, and
  // the mic frames driving this stall under load. Sampling "is a target
  // active right now" drops whole notes — "plays only partially and stops".
  it('back-fills notes that fell entirely between two samples', () => {
    const scheduler = createZenNoteScheduler()
    // 0 → 0.05 warms the clock, then a 1.2 s stall swallows b and c whole.
    scheduler.sample({ elapsedSec: 0.05, loopIndex: 0, targets: PHRASE })
    const afterStall = scheduler.sample({
      elapsedSec: 1.25,
      loopIndex: 0,
      targets: PHRASE,
    })

    expect(ids(afterStall)).toEqual(['b', 'c'])
  })

  it('back-fills in start order however wide the gap', () => {
    const scheduler = createZenNoteScheduler()
    const cues = scheduler.sample({
      elapsedSec: 1.9,
      loopIndex: 0,
      targets: [PHRASE[3]!, PHRASE[0]!, PHRASE[2]!, PHRASE[1]!],
    })
    expect(ids(cues)).toEqual(['a', 'b', 'c', 'd'])
  })

  // REQ-ZENP-015.
  it('sounds each target once however many samples land inside it', () => {
    const scheduler = createZenNoteScheduler()
    const heard: string[] = []
    for (const elapsedSec of [0.01, 0.1, 0.2, 0.3, 0.4, 0.49]) {
      heard.push(
        ...ids(scheduler.sample({ elapsedSec, loopIndex: 0, targets: PHRASE })),
      )
    }
    expect(heard).toEqual(['a'])
  })

  // REQ-ZENP-016. The mirror-image failure of the back-fill, and a real
  // regression on the piano side once (commit c38b8cc0, "replayed [A,B] at
  // once each lap"): a seam must not dump the previous lap's notes.
  it('does not replay the lap at the seam', () => {
    const scheduler = createZenNoteScheduler()
    scheduler.sample({ elapsedSec: 1.9, loopIndex: 0, targets: PHRASE })

    // The seam: elapsed drops back to ~0 and the lap counter moves on.
    const atSeam = scheduler.sample({
      elapsedSec: 0.02,
      loopIndex: 1,
      targets: PHRASE,
    })
    expect(ids(atSeam)).toEqual(['a'])
  })

  it('does not back-fill across a re-arm', () => {
    const scheduler = createZenNoteScheduler()
    scheduler.sample({ elapsedSec: 0.05, loopIndex: 0, targets: PHRASE })
    scheduler.rearm()

    // Everything from 0.05 to 1.6 is behind the playhead; a plain re-arm
    // (pause, resume, exercise change) sounds none of it.
    const afterRearm = scheduler.sample({
      elapsedSec: 1.6,
      loopIndex: 0,
      targets: PHRASE,
    })
    expect(afterRearm).toEqual([])

    // And the scheduler is still live for what comes next.
    const later = scheduler.sample({
      elapsedSec: 1.9,
      loopIndex: 1,
      targets: PHRASE,
    })
    expect(ids(later)).toEqual(['a', 'b', 'c', 'd'])
  })

  // REQ-ZENP-019.
  it('sounds only the target under the playhead when unmuted mid-lap', () => {
    const scheduler = createZenNoteScheduler()
    scheduler.sample({ elapsedSec: 0.05, loopIndex: 0, targets: PHRASE })
    scheduler.rearm({ soundCurrent: true })

    // Mid-c. a and b have passed and stay silent; c is under the playhead.
    const onUnmute = scheduler.sample({
      elapsedSec: 1.2,
      loopIndex: 0,
      targets: PHRASE,
    })
    expect(ids(onUnmute)).toEqual(['c'])

    // c does not sound a second time, and d still arrives on schedule.
    expect(
      ids(scheduler.sample({ elapsedSec: 1.3, loopIndex: 0, targets: PHRASE })),
    ).toEqual([])
    expect(
      ids(scheduler.sample({ elapsedSec: 1.6, loopIndex: 0, targets: PHRASE })),
    ).toEqual(['d'])
  })

  it('sounds nothing on unmute in a gap between targets', () => {
    const scheduler = createZenNoteScheduler()
    const gapped = [target('a', 0, 0.5), target('b', 1.5, 2)]
    scheduler.sample({ elapsedSec: 0.1, loopIndex: 0, targets: gapped })
    scheduler.rearm({ soundCurrent: true })
    expect(
      scheduler.sample({ elapsedSec: 0.9, loopIndex: 0, targets: gapped }),
    ).toEqual([])
  })

  it('resyncs silently when the clock is rebased backwards', () => {
    const scheduler = createZenNoteScheduler()
    scheduler.sample({ elapsedSec: 1.9, loopIndex: 0, targets: PHRASE })
    // Same lap, earlier time: the loop length changed under us. Replaying
    // from here would double every target in the lap.
    expect(
      scheduler.sample({ elapsedSec: 0.4, loopIndex: 0, targets: PHRASE }),
    ).toEqual([])
    expect(
      ids(scheduler.sample({ elapsedSec: 0.6, loopIndex: 0, targets: PHRASE })),
    ).toEqual(['b'])
  })

  it('fires a target sitting exactly on the seam', () => {
    const scheduler = createZenNoteScheduler()
    expect(
      ids(scheduler.sample({ elapsedSec: 0, loopIndex: 0, targets: PHRASE })),
    ).toEqual(['a'])
  })
})

describe('zenToneDurationSec', () => {
  it('clamps a tone to an audible, non-droning length', () => {
    expect(zenToneDurationSec(target('short', 0, 0.05))).toBeCloseTo(0.3, 5)
    expect(zenToneDurationSec(target('mid', 0, 0.8))).toBeCloseTo(0.8, 5)
    expect(zenToneDurationSec(target('long', 0, 6))).toBeCloseTo(1.2, 5)
  })
})
