// ============================================================
// Compare in the native room, drill by drill, on a fake engine. After a
// miss the room offers it, names the answer and the pick in the drill's
// own words, and sounds the answer and then the pick from the question's
// own reference: Leap's first note, Stack's root, Contour's first tone,
// the key of Cadence, Bassline and Home. It stops with Next and with the
// room closing. Hear it again in Cadence and Bassline keeps the key the
// question was asked in. The Pull offers no Compare.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type * as Banks from '@/lib/ear/banks'
import type { EarBankItem } from '@/lib/ear/banks'
import type * as ItemBank from '@/lib/ear/item-bank'
import { HOME_SET, probeMidi } from '@/lib/ear/item-bank'
import { bassRootMidi, CADENCE_BANK, degreeChordMidis, progressionName, } from '@/lib/ear/progressions'
import { BASSLINE_TIMING, CADENCE_TIMING, COMPARE_TIMING, CONTOUR_TIMING, HOME_TIMING, LEAP_TIMING, STACK_TIMING, } from '@/lib/ear/timing'
import type * as NativeBuild from '@/lib/native-build'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { midiToFreq } from '@/lib/scale-data'
import { resetEarLabStore } from '@/stores/ear-lab-store'
import { BasslineDrill } from './BasslineDrill'
import { CadenceDrill } from './CadenceDrill'
import { ContourDrill } from './ContourDrill'
import type { EarStageProps } from './EarStage'
import { HomeDrill } from './HomeDrill'
import { LeapDrill } from './LeapDrill'
import { PullDrill } from './PullDrill'
import { setRevealRule } from './reveal-pacing'
import { StackDrill } from './StackDrill'
import type { StageRoom } from './stage-room'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  EAR_LAB_WITH_MERC: true,
}))
vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
// The arming click sounds through the app's engine; Compare does not.
vi.mock('./arming-cue', () => ({ useArmingCue: () => undefined }))

/** Each drill's question, fixed, so the test knows what it heard. */
const PICKS = vi.hoisted(
  () =>
    new Set([
      'leap:P5',
      'stack:maj',
      'contour:100',
      'cadence:I-V-vi-IV',
      'bassline:1451',
    ]),
)
vi.mock('@/lib/ear/banks', async (importOriginal) => {
  const original = await importOriginal<typeof Banks>()
  return {
    ...original,
    pickBankItem: (bank: readonly EarBankItem[]) =>
      bank.find((item) => PICKS.has(item.itemId)) ?? bank[0],
  }
})

/** The keys the drills rove into: the first round's, then any other. */
const keys = vi.hoisted(() => ({ next: [] as number[], fallback: 55 }))
vi.mock('@/lib/ear/item-bank', async (importOriginal) => {
  const original = await importOriginal<typeof ItemBank>()
  return {
    ...original,
    roveRootMidi: () => keys.next.shift() ?? keys.fallback,
    // Home asks for Sol, every round.
    pickHomeItem: () => {
      const degree = original.HOME_SET.degrees[4]
      return { itemId: original.HOME_SET.itemId(5), degree, difficulty: 1000 }
    },
  }
})

/** Every strum the guitar drills ask for, as the notes struck. */
const strums = vi.hoisted(() => ({ calls: [] as number[][] }))
vi.mock('./guitar-chords', () => ({
  createStrummer: () => {
    let cancelled = false
    return {
      strum: (midis: readonly number[]) => {
        if (!cancelled) strums.calls.push([...midis])
      },
      cancel: () => {
        cancelled = true
      },
    }
  },
}))

/** The stage the drill hands its room, with its console drawn. */
const handed = vi.hoisted(() => ({
  props: undefined as EarStageProps | undefined,
}))
vi.mock('./stage-switch', () => ({
  EarStage: (props: EarStageProps) => {
    // eslint-disable-next-line solid/reactivity -- kept to drive and read back
    handed.props = props
    // eslint-disable-next-line solid/reactivity -- the console is a view, drawn once as the stage would
    return props.console()
  },
}))

const engine = {
  init: vi.fn(async () => undefined),
  resume: vi.fn(async () => undefined),
  getAudioContext: () => ({ currentTime: 0 }),
  getVolume: () => 0.8,
  playTone: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
  playChord: vi.fn(async () => undefined),
  stopTone: vi.fn(),
}

function mount(drill: () => JSX.Element) {
  return render(() => (
    <EngineContext.Provider
      value={{
        audioEngine: engine as unknown as AudioEngine,
        playbackRuntime: {} as PlaybackRuntime,
        practiceEngine: {} as PracticeEngine,
        ready: () => true,
      }}
    >
      {drill()}
    </EngineContext.Provider>
  ))
}

function room(): StageRoom {
  const handedRoom = handed.props?.room
  if (!handedRoom) throw new Error('the drill handed its stage no room')
  return handedRoom
}

/** The tones sounded since `from`: frequency, length and any chord. */
function tonesSince(from: number): unknown[][] {
  return engine.playTone.mock.calls
    .slice(from)
    .map((call) =>
      call[10] === undefined
        ? [call[0], call[1]]
        : [call[0], call[1], call[10]],
    )
}

/** Press the pad that shows this label. */
function press(label: string): void {
  const pad = screen.getByText(label).closest('button')
  if (!pad) throw new Error(`no pad ${label}`)
  fireEvent.click(pad)
}

/** Answer through the stage's keys, as a keyboard would. */
function key(name: string): void {
  const found = handed.props?.keys?.().find((entry) => entry.key === name)
  if (!found) throw new Error(`no key ${name}`)
  found.action(0)
}

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms)

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
  vi.clearAllMocks()
  strums.calls = []
  keys.next = [48]
  // The room's pacing: a miss waits for Next.
  setRevealRule('merc')
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'Date',
      'performance',
    ],
  })
})

afterEach(() => {
  cleanup()
  setRevealRule('switch')
  handed.props = undefined
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const LEAP_PAIR = 2 * LEAP_TIMING.toneMs + LEAP_TIMING.gapMs
const LEAP_SLOW = 2 * LEAP_TIMING.replayToneMs + LEAP_TIMING.replayGapMs

/** Leap on a miss: the fifth asked, the fourth picked, the slow replay
 *  heard out. 0.25 roves a rising leap from MIDI 53, 0.75 a falling one
 *  from 71 (its root 64 plus the fifth). */
async function leapMiss(random: number): Promise<{ unmount: () => void }> {
  vi.spyOn(Math, 'random').mockReturnValue(random)
  const mounted = mount(() => <LeapDrill onBack={vi.fn()} />)
  room().again?.()
  await advance(LEAP_PAIR)
  expect(room().beat()).toBe('answer')
  press('P4')
  await advance(LEAP_SLOW)
  expect(room().parked()).toBe(true)
  return mounted
}

describe('Compare in Leap', () => {
  it.each([
    ['rising', 0.25, 53, 1],
    ['falling', 0.75, 71, -1],
  ])(
    'plays a %s fifth, then your fourth, from the same first note',
    async (_way, random, first, way) => {
      await leapMiss(random)
      const compare = room().compare
      expect(compare?.offered()).toBe(true)
      expect(compare?.allowed()).toBe(true)
      expect(compare?.names()).toEqual({ answer: 'the fifth', pick: 'fourth' })
      expect(compare?.difference?.()).toBe('Two semitones wider.')

      const from = engine.playTone.mock.calls.length
      compare?.play()
      await advance(0)
      expect(room().sounding()).toBe(true)
      expect(compare?.allowed()).toBe(false)
      expect(room().replay?.allowed()).toBe(false)
      await advance(2 * LEAP_PAIR + COMPARE_TIMING.gapMs)

      const tone = LEAP_TIMING.toneMs
      expect(tonesSince(from)).toEqual([
        [midiToFreq(first), tone],
        [midiToFreq(first + way * 7), tone],
        [midiToFreq(first), tone],
        [midiToFreq(first + way * 5), tone],
      ])
      expect(room().sounding()).toBe(false)
      expect(room().beat()).toBe('reveal')
      expect(compare?.allowed()).toBe(true)
    },
  )

  it('offers nothing on a right answer', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    mount(() => <LeapDrill onBack={vi.fn()} />)
    room().again?.()
    await advance(LEAP_PAIR)
    press('P5')
    await advance(0)
    expect(room().beat()).toBe('reveal')
    expect(room().compare?.offered()).toBe(false)
  })

  it('stops with Next: your fourth never sounds', async () => {
    await leapMiss(0.25)
    const from = engine.playTone.mock.calls.length
    room().compare?.play()
    // Into the breath between the fifth and the fourth.
    await advance(LEAP_PAIR + COMPARE_TIMING.gapMs / 2)

    room().next()
    expect(engine.stopTone).toHaveBeenCalled()
    await advance(4 * LEAP_PAIR)
    expect(tonesSince(from)).not.toContainEqual([
      midiToFreq(58),
      LEAP_TIMING.toneMs,
    ])
  })

  it('sounds nothing more once the room closes', async () => {
    const { unmount } = await leapMiss(0.25)
    room().compare?.play()
    await advance(LEAP_TIMING.toneMs / 2)
    const sounded = engine.playTone.mock.calls.length

    unmount()
    expect(engine.stopTone).toHaveBeenCalled()
    await advance(4 * LEAP_PAIR)
    expect(engine.playTone).toHaveBeenCalledTimes(sounded)
  })
})

describe('Compare in Stack', () => {
  it('stacks the major chord, then your minor, on the same root', async () => {
    // 0.25 roves the root to MIDI 51.
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    mount(() => <StackDrill onBack={vi.fn()} />)
    room().again?.()
    await advance(STACK_TIMING.chordMs)
    press('Min')
    await advance(3 * STACK_TIMING.brokenNoteMs + STACK_TIMING.replayChordMs)
    expect(room().compare?.names()).toEqual({
      answer: 'the major chord',
      pick: 'minor chord',
    })

    const from = engine.playTone.mock.calls.length
    room().compare?.play()
    await advance(2 * STACK_TIMING.chordMs + COMPARE_TIMING.gapMs)
    expect(tonesSince(from)).toEqual([
      [midiToFreq(51), STACK_TIMING.chordMs, [4, 7]],
      [midiToFreq(51), STACK_TIMING.chordMs, [3, 7]],
    ])
    expect(room().sounding()).toBe(false)
  })
})

describe('Compare in Contour', () => {
  it('plays the rise, then your fall, from the same first tone by the same gap', async () => {
    // 0.25 draws "up", and the first tone at 220 Hz times 2^0.375.
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    const base = 220 * 2 ** (0.25 * 1.5)
    mount(() => <ContourDrill onBack={vi.fn()} />)
    room().again?.()
    await advance(2 * CONTOUR_TIMING.toneMs + CONTOUR_TIMING.gapMs)
    press('Down')
    await advance(2 * CONTOUR_TIMING.replayToneMs + CONTOUR_TIMING.replayGapMs)
    expect(room().compare?.names()).toEqual({
      answer: 'the rise',
      pick: 'fall',
    })

    const from = engine.playTone.mock.calls.length
    room().compare?.play()
    await advance(
      2 * (2 * CONTOUR_TIMING.toneMs + CONTOUR_TIMING.gapMs) +
        COMPARE_TIMING.gapMs,
    )
    const tone = CONTOUR_TIMING.toneMs
    expect(tonesSince(from)).toEqual([
      [base, tone],
      [base * 2 ** (100 / 1200), tone],
      [base, tone],
      [base * 2 ** (-100 / 1200), tone],
    ])
  })
})

/** The chords Cadence strums for a progression, in a key. */
const progression = (root: number, degrees: readonly number[]) =>
  degrees.map((degree) => degreeChordMidis(root, degree))

/** How long a progression of `chords` takes to strum. */
const strumMs = (chords: number, chordMs: number) =>
  CADENCE_TIMING.leadInS * 1000 +
  chords * (chordMs + CADENCE_TIMING.gapMs) +
  CADENCE_TIMING.tailMs

describe('Cadence in the room', () => {
  /** A miss: the first pad that is not the answer, picked. */
  async function cadenceMiss(): Promise<{ id: string; degrees: number[] }> {
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    mount(() => <CadenceDrill onBack={vi.fn()} />)
    room().again?.()
    await advance(strumMs(4, CADENCE_TIMING.chordMs))
    expect(room().beat()).toBe('answer')
    const wrong = CADENCE_BANK.find(
      (item) =>
        item.itemId !== 'cadence:I-V-vi-IV' &&
        screen.queryByText(item.label) !== null,
    )
    if (!wrong) throw new Error('no other progression on the pads')
    press(wrong.label)
    await advance(strumMs(4, CADENCE_TIMING.replayChordMs))
    expect(room().parked()).toBe(true)
    return { id: wrong.itemId, degrees: [...wrong.payload] }
  }

  it('strums the progression, then yours, in the key it was asked in', async () => {
    const wrong = await cadenceMiss()
    expect(room().compare?.names()).toEqual({
      answer: 'I–V–vi–IV',
      pick: progressionName(wrong.degrees),
    })

    const from = strums.calls.length
    room().compare?.play()
    await advance(
      strumMs(4, CADENCE_TIMING.chordMs) +
        COMPARE_TIMING.gapMs +
        strumMs(wrong.degrees.length, CADENCE_TIMING.chordMs),
    )
    expect(strums.calls.slice(from)).toEqual([
      ...progression(48, [1, 5, 6, 4]),
      ...progression(48, wrong.degrees),
    ])
    expect(room().sounding()).toBe(false)
  })

  it('hears it again in the same key, the pads as they were', async () => {
    await cadenceMiss()
    const pads = screen
      .getAllByRole('button')
      .map((button) => button.textContent)

    const from = strums.calls.length
    room().replay?.play()
    await advance(strumMs(4, CADENCE_TIMING.chordMs))
    expect(strums.calls.slice(from)).toEqual(progression(48, [1, 5, 6, 4]))
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(pads)
  })

  it('lets a miss wait for Next when the sound is taken away during its slow strum', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    mount(() => <CadenceDrill onBack={vi.fn()} />)
    room().again?.()
    await advance(strumMs(4, CADENCE_TIMING.chordMs))
    const wrong = CADENCE_BANK.find(
      (item) =>
        item.itemId !== 'cadence:I-V-vi-IV' &&
        screen.queryByText(item.label) !== null,
    )
    if (!wrong) throw new Error('no other progression on the pads')
    press(wrong.label)
    await advance(CADENCE_TIMING.leadInS * 1000 + 100)
    expect(room().sounding()).toBe(true)

    room().hold?.()
    await advance(0)

    // Cut short, the strum still ended: the verdict waits for Next.
    expect(room().sounding()).toBe(false)
    expect(room().parked()).toBe(true)
  })

  it('strums nothing once the room closes while the audio wakes', async () => {
    await cadenceMiss()
    let wake = (): void => undefined
    engine.resume.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          wake = () => resolve(undefined)
        }),
    )
    room().compare?.play()
    await advance(0)
    const from = strums.calls.length

    cleanup()
    wake()
    await advance(2 * strumMs(4, CADENCE_TIMING.chordMs))
    expect(strums.calls.length).toBe(from)
  })
})

/** A line as Bassline strikes it: the tonic chord held, four roots. */
const bassLine = (root: number, degrees: readonly number[]) => [
  degreeChordMidis(root, 1),
  ...degrees.map((degree) => [bassRootMidi(root, degree)]),
]

const lineMs = (rootMs: number) =>
  BASSLINE_TIMING.leadInS * 1000 +
  BASSLINE_TIMING.restMs +
  4 * (rootMs + BASSLINE_TIMING.rootGapMs) +
  BASSLINE_TIMING.tailMs

describe('Bassline in the room', () => {
  /** The line I IV V I, tapped back as I IV vi I. */
  async function basslineMiss(): Promise<void> {
    mount(() => <BasslineDrill onBack={vi.fn()} />)
    room().again?.()
    await advance(lineMs(BASSLINE_TIMING.rootMs))
    expect(room().beat()).toBe('answer')
    for (const degree of ['1', '4', '6', '1']) key(degree)
    await advance(lineMs(BASSLINE_TIMING.replayRootMs))
    expect(room().parked()).toBe(true)
  }

  it('walks the line, then the one you tapped, under the same tonic', async () => {
    await basslineMiss()
    expect(room().compare?.names()).toEqual({
      answer: 'I–IV–V–I',
      pick: 'I–IV–vi–I',
    })

    const from = strums.calls.length
    room().compare?.play()
    await advance(2 * lineMs(BASSLINE_TIMING.rootMs) + COMPARE_TIMING.gapMs)
    expect(strums.calls.slice(from)).toEqual([
      ...bassLine(48, [1, 4, 5, 1]),
      ...bassLine(48, [1, 4, 6, 1]),
    ])
  })

  it('lets a miss wait for Next when the sound is taken away during its slow line', async () => {
    mount(() => <BasslineDrill onBack={vi.fn()} />)
    room().again?.()
    await advance(lineMs(BASSLINE_TIMING.rootMs))
    for (const degree of ['1', '4', '6', '1']) key(degree)
    await advance(BASSLINE_TIMING.leadInS * 1000 + 100)
    expect(room().sounding()).toBe(true)

    room().hold?.()
    await advance(0)

    // Cut short, the line still ended: the verdict waits for Next.
    expect(room().sounding()).toBe(false)
    expect(room().parked()).toBe(true)
  })

  it('hears the line again in the same key', async () => {
    await basslineMiss()
    const from = strums.calls.length
    room().replay?.play()
    await advance(lineMs(BASSLINE_TIMING.rootMs))
    expect(strums.calls.slice(from)).toEqual(bassLine(48, [1, 4, 5, 1]))
    // The verdict's pick stays for Compare.
    expect(room().compare?.offered()).toBe(true)
  })
})

describe('Compare in Home', () => {
  it('plays Sol, then your Fa, in the round key', async () => {
    mount(() => <HomeDrill onBack={vi.fn()} />)
    room().again?.()
    await advance(
      4 * (HOME_TIMING.chordMs + HOME_TIMING.chordGapMs) + HOME_TIMING.probeMs,
    )
    expect(room().beat()).toBe('answer')
    key('4')
    expect(room().sounding()).toBe(true)
    await advance(HOME_TIMING.resolutionProbeMs + HOME_TIMING.resolutionTonicMs)
    expect(room().compare?.names()).toEqual({ answer: 'Sol', pick: 'Fa' })

    const from = engine.playTone.mock.calls.length
    room().compare?.play()
    await advance(2 * HOME_TIMING.probeMs + COMPARE_TIMING.gapMs)
    expect(tonesSince(from)).toEqual([
      [midiToFreq(probeMidi(48, 5, HOME_SET)), HOME_TIMING.probeMs],
      [midiToFreq(probeMidi(48, 4, HOME_SET)), HOME_TIMING.probeMs],
    ])
  })
})

describe('the Pull', () => {
  it('offers no Compare: its pick is one of the two notes it played', () => {
    mount(() => <PullDrill onBack={vi.fn()} />)
    expect(room().compare).toBeUndefined()
  })
})
