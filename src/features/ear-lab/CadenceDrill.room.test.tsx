// Cadence in the native room: a slip names its progressions as the drill
// writes them (vi stays vi), and a pair practice from it keeps both on
// the four pads every round, so the menu never says which of the two it
// was.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type * as Banks from '@/lib/ear/banks'
import type { EarBankItem } from '@/lib/ear/banks'
import { CADENCE_BANK } from '@/lib/ear/progressions'
import { CADENCE_TIMING, REVEAL_HOLD } from '@/lib/ear/timing'
import type * as NativeBuild from '@/lib/native-build'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { resetEarLabStore } from '@/stores/ear-lab-store'
import { CadenceDrill } from './CadenceDrill'
import type { EarStageProps } from './EarStage'
import { PAIR_PRACTICE_ROUNDS } from './pair-practice'
import { setRevealRule } from './reveal-pacing'
import type { StageRoom } from './stage-room'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  EAR_LAB_WITH_MERC: true,
}))
vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('./arming-cue', () => ({ useArmingCue: () => undefined }))
// A rated run asks I–IV–V every round.
vi.mock('@/lib/ear/banks', async (importOriginal) => {
  const original = await importOriginal<typeof Banks>()
  return {
    ...original,
    pickBankItem: (bank: readonly EarBankItem[]) => bank[0],
  }
})
vi.mock('@/lib/guitar/guitar-synth', () => {
  const voice = () => ({
    gain: {
      gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    },
    dispose: vi.fn(),
  })
  return { createGuitarVoice: vi.fn(voice), createBassVoice: vi.fn(voice) }
})

/** The room the drill hands its stage, and the stage drawn as its
 *  console alone: the pads are what this test reads. */
const handed: { room: StageRoom | undefined } = { room: undefined }
vi.mock('./stage-switch', () => ({
  EarStage: (props: EarStageProps) => {
    // eslint-disable-next-line solid/reactivity -- kept to read back
    handed.room = props.room
    // eslint-disable-next-line solid/reactivity -- drawn once, as the stage draws it
    return props.console()
  },
}))

const ctx = {
  currentTime: 1,
  destination: {},
  createGain: vi.fn(() => ({
    gain: { setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}
const engine = {
  init: vi.fn(async () => undefined),
  resume: vi.fn(async () => undefined),
  getAudioContext: () => ctx,
  getVolume: () => 0.8,
  setToneTrim: vi.fn(),
  stopTone: vi.fn(),
}

function Stage(props: { children: JSX.Element }): JSX.Element {
  return (
    <EngineContext.Provider
      value={{
        audioEngine: engine as unknown as AudioEngine,
        playbackRuntime: {} as PlaybackRuntime,
        practiceEngine: {} as PracticeEngine,
        ready: () => true,
      }}
    >
      {props.children}
    </EngineContext.Provider>
  )
}

/** The longest a question and its verdict take: the slow strum after a
 *  miss, and the hold after it. */
const LONGEST =
  CADENCE_TIMING.leadInS * 1000 +
  3 * (CADENCE_TIMING.replayChordMs + CADENCE_TIMING.gapMs) +
  CADENCE_TIMING.tailMs +
  REVEAL_HOLD.defaultMs

function room(): StageRoom {
  if (!handed.room) throw new Error('Cadence handed its stage no room')
  return handed.room
}

/** Run the clock until the room is on `beat`. */
async function until(beat: 'answer' | 'done'): Promise<void> {
  for (let ms = 0; ms < 2 * LONGEST && room().beat() !== beat; ms += 50) {
    await vi.advanceTimersByTimeAsync(50)
  }
  expect(room().beat()).toBe(beat)
}

const pads = (): HTMLElement[] =>
  within(screen.getByTestId('ear-stage-pads')).getAllByRole('button')
const labelOf = (name: string): string =>
  CADENCE_BANK.find((item) => item.name === name)?.label ?? name

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
  vi.clearAllMocks()
  setRevealRule('switch')
  vi.useFakeTimers()
  // The menus and the practice's order drawn the same way on every run.
  let seed = 11
  vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (seed * 48271) % 2147483647
    return seed / 2147483647
  })
})

afterEach(() => {
  cleanup()
  handed.room = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("Cadence's pair practice", () => {
  it('keeps both progressions on the pads every round', async () => {
    render(() => (
      <Stage>
        <CadenceDrill onBack={vi.fn()} />
      </Stage>
    ))

    // A rated run, every round missed: on vi–IV–I–V wherever the menu
    // offers it.
    room().again?.()
    for (let round = 0; round < 12; round++) {
      await until('answer')
      const wrong = pads().filter(
        (pad) => !(pad.textContent ?? '').includes('I–IV–V'),
      )
      const minor = wrong.find((pad) =>
        (pad.textContent ?? '').includes('vi–IV–I–V'),
      )
      fireEvent.click(minor ?? wrong[0])
      await vi.advanceTimersByTimeAsync(0)
    }
    await until('done')
    const rated = room().plate?.()
    if (rated?.kind !== 'rating') throw new Error('no rated plate')
    const names = new Set(CADENCE_BANK.map((item) => item.name))
    expect(rated.slips.map((entry) => entry.answered)).toContain('vi–IV–I–V')
    for (const entry of rated.slips) {
      expect(names.has(entry.expected)).toBe(true)
      expect(names.has(entry.answered)).toBe(true)
    }
    const slip = rated.slips[0]
    const pair = [labelOf(slip.expected), labelOf(slip.answered)]

    slip.practise?.()
    expect(room().run()).toBe('practice')
    for (let round = 0; round < PAIR_PRACTICE_ROUNDS; round++) {
      await until('answer')
      const shown = pads().map((pad) => pad.textContent ?? '')
      expect(shown).toHaveLength(4)
      for (const label of pair) {
        expect(shown.some((text) => text.includes(label))).toBe(true)
      }
      fireEvent.click(pads()[0])
      await vi.advanceTimersByTimeAsync(0)
    }
    await until('done')
    expect(room().plate?.()?.kind).toBe('practice')
  })
})
