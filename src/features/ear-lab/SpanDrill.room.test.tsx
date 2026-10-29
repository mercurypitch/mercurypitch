// Span in the native room, answered by singing: Hear it again before the
// answer is open, as for tapped answers. While the phrase sounds again
// the microphone hears the speaker, so that is set aside and the take
// neither closes nor times out; then it carries on with the notes it had.
// Once a practice question, as tapped answers have it.

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type * as ItemBank from '@/lib/ear/item-bank'
import type * as Phrase from '@/lib/ear/phrase'
import { SPAN_TIMING } from '@/lib/ear/timing'
import type * as NativeBuild from '@/lib/native-build'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { midiToFreq } from '@/lib/scale-data'
import { resetEarLabStore } from '@/stores/ear-lab-store'
import type { EarStageProps } from './EarStage'
import { setRevealRule } from './reveal-pacing'
import { SpanDrill } from './SpanDrill'
import type { RoomBeat, StageRoom } from './stage-room'
import { SUNG_ANSWER, sungAnswerCeilingMs } from './use-sung-answer'

const mic = vi.hoisted(() => ({
  frames: [] as PitchFrame[],
  windows: 0,
}))

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  EAR_LAB_WITH_MERC: true,
}))
vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(async () => undefined),
  activateAudioPlayback: vi.fn(async () => undefined),
}))
vi.mock('./arming-cue', () => ({ useArmingCue: () => undefined }))
vi.mock('@/lib/mic-manager', () => ({
  micManager: {
    acquire: vi.fn(async () => ({}) as MediaStream),
    release: vi.fn(),
  },
}))
vi.mock('@/lib/pitch-f0-stream', () => ({
  createF0Stream: () => ({
    startTask: () => {
      mic.windows += 1
      mic.frames = []
    },
    takeFrames: () => mic.frames,
    peekFrames: () => mic.frames,
    latest: () => null,
    latestLevel: () => 0.1,
    dispose: vi.fn(),
  }),
}))
vi.mock('@/lib/ear/item-bank', async (importOriginal) => ({
  ...(await importOriginal<typeof ItemBank>()),
  roveRootMidi: () => 60,
}))
// The phrase is Do Sol Do.
vi.mock('@/lib/ear/phrase', async (importOriginal) => ({
  ...(await importOriginal<typeof Phrase>()),
  randomPhrase: () => [1, 5, 1],
}))

/** What the drill hands its stage, and its console drawn: the answer
 *  mode and Practice run are pressed there. */
const handed: { props: EarStageProps | undefined } = { props: undefined }
vi.mock('./stage-switch', () => ({
  EarStage: (props: EarStageProps) => {
    // eslint-disable-next-line solid/reactivity -- kept to read back
    handed.props = props
    // eslint-disable-next-line solid/reactivity -- drawn once, as the stage draws it
    return props.console()
  },
}))

function stage(): EarStageProps {
  if (!handed.props) throw new Error('Span handed nothing to its stage')
  return handed.props
}

function room(): StageRoom {
  const own = stage().room
  if (!own) throw new Error('Span handed its stage no room')
  return own
}

async function until(beat: RoomBeat): Promise<void> {
  for (let ms = 0; ms < 10_000 && room().beat() !== beat; ms += 50) {
    await vi.advanceTimersByTimeAsync(50)
  }
  expect(room().beat()).toBe(beat)
}

/** Notes heard from `fromS`, 350 ms each with a 150 ms breath between,
 *  then `silenceS` of silence, at the stream's hop. */
function notes(midis: number[], fromS: number, silenceS = 0): PitchFrame[] {
  const frames: PitchFrame[] = []
  const push = (t: number, midi: number) =>
    frames.push({
      t: Math.round(t * 1000) / 1000,
      f0: midi > 0 ? midiToFreq(midi) : 0,
      conf: midi > 0 ? 0.9 : 0,
      rms: midi > 0 ? 0.2 : 0.01,
    } as PitchFrame)
  let t = fromS
  for (const midi of midis) {
    for (let k = 0; k < 22; k++) push(t + k * 0.016, midi)
    t += 0.35
    for (let k = 0; k < 9; k++) push(t + k * 0.016, 0)
    t += 0.15
  }
  for (let k = 0; k * 0.016 < silenceS; k++) push(t + k * 0.016, 0)
  return frames
}

/** The phrase again: the cadence, the rest, three notes, and the tails. */
const REPLAY_MS =
  4 * (SPAN_TIMING.chordMs + SPAN_TIMING.chordGapMs) +
  SPAN_TIMING.restMs +
  3 * (SPAN_TIMING.noteMs + SPAN_TIMING.gapMs) +
  SPAN_TIMING.tailMs +
  SPAN_TIMING.heardTailMs

const engine = {
  init: vi.fn(async () => undefined),
  resume: vi.fn(async () => undefined),
  getAudioContext: () => ({}) as AudioContext,
  getVolume: () => 0.8,
  setToneTrim: vi.fn(),
  playTone: vi.fn(async () => undefined),
  playChord: vi.fn().mockResolvedValue(undefined),
  stopTone: vi.fn(),
}

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
  setRevealRule('merc')
  mic.frames = []
  mic.windows = 0
  vi.useFakeTimers()
})

afterEach(() => {
  handed.props = undefined
  setRevealRule('switch')
  vi.useRealTimers()
})

describe("Span's Hear it again, sung", () => {
  it('sets the phrase aside from the take, then carries the take on', async () => {
    render(() => (
      <EngineContext.Provider
        value={{
          audioEngine: engine as unknown as AudioEngine,
          practiceEngine: {} as PracticeEngine,
          playbackRuntime: {} as PlaybackRuntime,
          ready: () => true,
        }}
      >
        <SpanDrill onBack={vi.fn()} />
      </EngineContext.Provider>
    ))
    fireEvent.click(screen.getByRole('radio', { name: 'Sing or play' }))
    fireEvent.click(screen.getByRole('button', { name: /Practice run/ }))
    await until('answer')
    expect(mic.windows).toBe(1)

    // Do, sung; then the singer wants the phrase again.
    mic.frames = notes([60], 0.2, 0.3)
    await vi.advanceTimersByTimeAsync(SUNG_ANSWER.pollMs)
    expect(room().replay?.allowed()).toBe(true)
    room().replay?.play()
    expect(room().beat()).toBe('listen')

    // The mic hears the speaker: the phrase, and silence long past the
    // window's own closing and its ceiling.
    mic.frames = [...mic.frames, ...notes([60, 67, 60], 1.2, 2)]
    await vi.advanceTimersByTimeAsync(REPLAY_MS - 50)
    expect(room().beat()).toBe('listen')
    expect(stage().status).not.toMatch(/Held|Slipped/)
    await vi.advanceTimersByTimeAsync(100)
    expect(room().beat()).toBe('answer')
    // Heard afresh from here, and the replay was the question's one.
    expect(mic.windows).toBe(2)
    expect(room().replay?.allowed()).toBe(false)

    // Sol and Do, sung: with the Do before the replay, the phrase whole.
    mic.frames = notes([67, 60], 0.3, 1.4)
    await vi.advanceTimersByTimeAsync(SUNG_ANSWER.pollMs)
    expect(stage().status).toBe(
      'Held. All 3 notes, Do Sol Do. The phrase grows.',
    )
    // Answered, it replays freely.
    expect(room().replay?.allowed()).toBe(true)
  })

  it('does not time out while the phrase sounds again', async () => {
    render(() => (
      <EngineContext.Provider
        value={{
          audioEngine: engine as unknown as AudioEngine,
          practiceEngine: {} as PracticeEngine,
          playbackRuntime: {} as PlaybackRuntime,
          ready: () => true,
        }}
      >
        <SpanDrill onBack={vi.fn()} />
      </EngineContext.Provider>
    ))
    fireEvent.click(screen.getByRole('radio', { name: 'Sing or play' }))
    fireEvent.click(screen.getByRole('button', { name: /Practice run/ }))
    await until('answer')
    const ceiling = sungAnswerCeilingMs(
      3 * (SPAN_TIMING.noteMs + SPAN_TIMING.gapMs),
    )

    // Most of the window gone in silence, then the phrase again.
    await vi.advanceTimersByTimeAsync(ceiling - 1000)
    room().replay?.play()
    await vi.advanceTimersByTimeAsync(REPLAY_MS + 50)
    expect(room().beat()).toBe('answer')
    // The second it had left is still its own.
    await vi.advanceTimersByTimeAsync(800)
    expect(room().beat()).toBe('answer')
    await vi.advanceTimersByTimeAsync(300)
    expect(room().beat()).toBe('reveal')
  })
})
