// Onboarding wording that a reader notices — the indefinite article in
// front of the note we just heard, and whether a Map card ever fails to
// say what its room is.
//
// See docs/specs/onboarding-first-value-copy.ears.md (FVC-*).

import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EXERCISE_HELP } from '@/features/exercises/exercise-help'
import { BeatFirstLight } from '@/features/onboarding/beats/BeatFirstLight'
import { BeatFork } from '@/features/onboarding/beats/BeatFork'
import { BeatMap } from '@/features/onboarding/beats/BeatMap'
import { pickFirstStop } from '@/features/onboarding/first-stop'
import { roomById, ROOMS } from '@/features/onboarding/rooms'
import type { MirrorResult, SteadinessResult } from '@/lib/mirror/metrics'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { OpenResult, ProbeResult, VoiceSession } from '@/lib/voice-session'

// Beat 2 is behind the microphone, so the take is faked at the session
// seam: a fixed tone in, a named note out. Nothing else about the beat
// is stubbed — the phase machine, `settledNote` and the headline all run
// for real.
const recorded = vi.fn<() => PitchFrame[]>(() => [])

vi.mock('@/lib/jam/media-errors', () => ({
  micPermissionState: (): Promise<string> => Promise.resolve('granted'),
}))

vi.mock('@/lib/voice-session', () => ({
  createVoiceSession: (): VoiceSession => {
    let open = false
    return {
      open: (): Promise<OpenResult> => {
        open = true
        return Promise.resolve({ ok: true } as OpenResult)
      },
      probe: (): Promise<ProbeResult> => Promise.resolve('ok' as ProbeResult),
      arm: (): void => {},
      record: (): Promise<PitchFrame[]> => Promise.resolve(recorded()),
      latest: () => null,
      latestSmoothed: () => null,
      level: (): number => 0,
      context: () => null,
      isOpen: (): boolean => open,
      devices: (): Promise<MediaDeviceInfo[]> => Promise.resolve([]),
      useDevice: (): Promise<ProbeResult> =>
        Promise.resolve('ok' as ProbeResult),
      close: (): void => {
        open = false
      },
    }
  },
}))

afterEach(cleanup)

const noop = (): void => {}

/** A steady tone, long enough for `settledNote` to trust the median. */
function tone(hz: number): PitchFrame[] {
  return Array.from({ length: 120 }, (_, i) => ({
    t: i * 0.016,
    f0: hz,
    conf: 0.95,
    rms: 0.2,
  }))
}

function forkText(firstNote: string | null, savedCount = 0): string {
  const { container } = render(() => (
    <BeatFork
      firstNote={firstNote}
      savedCount={savedCount}
      savedWhen={savedCount > 0 ? 'yesterday' : null}
      onChoose={noop}
      onAnother={noop}
    />
  ))
  return container.textContent ?? ''
}

/**
 * Drive beat 2 from the ask screen to the result screen on a held tone,
 * and hand back the headline it lands on.
 */
async function heardHeadline(hz: number): Promise<string> {
  recorded.mockReturnValue(tone(hz))
  const { container, findByText } = render(() => (
    <BeatFirstLight onHeard={noop} onContinue={noop} onDenied={noop} />
  ))

  fireEvent.click(await findByText('Start listening'))
  fireEvent.click(await findByText('Start the take now'))

  await waitFor(() => {
    expect(container.querySelector('h1')?.textContent).toContain("That's")
  })
  return container.querySelector('h1')?.textContent ?? ''
}

describe('beat 2 — the note said back', () => {
  // FVC-1
  it('says "an" before a vowel-sound note name', async () => {
    // A3 is 220 Hz — the exact note in the report.
    expect(await heardHeadline(220)).toBe("That's an A3")
  })

  // FVC-2
  it('keeps "a" before every other note name', async () => {
    expect(await heardHeadline(196)).toBe("That's a G3")
  })
})

describe('beat 3 — the note we heard, said back', () => {
  // FVC-1
  it('says "an" before a vowel-sound note name', () => {
    expect(forkText('A3')).toContain('You sang an A3.')
    expect(forkText('E4')).toContain('You sang an E4.')
    expect(forkText('F2')).toContain('You sang an F2.')
  })

  // FVC-2
  it('keeps "a" before every other note name', () => {
    expect(forkText('G3')).toContain('You sang a G3.')
    expect(forkText('C4')).toContain('You sang a C4.')
    expect(forkText('B3')).toContain('You sang a B3.')
  })

  // FVC-3
  it('fixes the article on the returning-singer fork too', () => {
    expect(forkText('A3', 1)).toContain('You sang an A3.')
    expect(forkText('G3', 1)).toContain('You sang a G3.')
  })

  // FVC-4
  it('says nothing about a note when the mic was skipped', () => {
    expect(forkText(null)).not.toContain('You sang')
    expect(forkText(null, 1)).not.toContain('You sang')
  })
})

/** Steadiness under the weak line, so a real first stop gets picked. */
const WOBBLY: MirrorResult = {
  range: null,
  accuracy: null,
  steadiness: {
    referenceCents: 0,
    referenceNote: 'C3',
    driftCentsPerSec: 0,
    wobbleSdCents: 30,
    vibrato: null,
    score: 40,
    voicedSeconds: 4,
  } as SteadinessResult,
}

function renderMap(): HTMLElement {
  const { container } = render(() => (
    <BeatMap voiceprint={WOBBLY} onEnter={noop} onTour={noop} onDone={noop} />
  ))
  return container
}

describe('the Map cards', () => {
  // FVC-5
  it('says what every room is, the recommended one included', () => {
    const text = renderMap().textContent ?? ''

    for (const room of ROOMS) {
      expect(text, `missing the line for ${room.id}`).toContain(room.line)
    }
  })

  // FVC-6
  it('carries the reason as well as the line on the first stop', () => {
    const stop = pickFirstStop(WOBBLY)
    const card = renderMap().querySelector<HTMLElement>(
      `[data-room="${stop.room}"]`,
    )
    const copy = card?.textContent ?? ''

    expect(copy).toContain('Your first stop')
    expect(copy).toContain(stop.reason)
    expect(copy).toContain(roomById(stop.room).line)
  })

  // FVC-7
  it('leads every room line with what the room is, not a bare verb', () => {
    // The lines are the Map's only explanation of a room, so each one has
    // to open with a noun phrase ("A library of…", "The live singing
    // stage — …"), never straight into an instruction.
    for (const room of ROOMS) {
      expect(room.line, `${room.id} should open with an article`).toMatch(
        /^(A|An|The|Your)\b/,
      )
    }
  })

  /** Spelled-out counts from ten up, which is the only range in play. */
  const NUMBER_WORDS: readonly string[] = [
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
    'twenty',
    'twenty-one',
    'twenty-two',
    'twenty-three',
    'twenty-four',
  ]

  // FVC-8
  it('counts the drills honestly on the Exercises card', () => {
    // EXERCISE_HELP is Record<ExerciseType, …>, so TypeScript keeps it
    // exhaustive — it is the real count, and this card said "fourteen"
    // through four additions.
    const drills = Object.keys(EXERCISE_HELP).length
    const word = NUMBER_WORDS[drills - 10]
    expect(word, `add ${drills} to NUMBER_WORDS`).toBeDefined()

    expect(roomById('exercises').line).toContain(`${word ?? ''} short drills`)
  })
})
