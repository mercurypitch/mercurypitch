// Onboarding wording that a reader notices — the indefinite article in
// front of the note we just heard, whether a Map card ever fails to say
// what its room is, and who is listening on the first note.
//
// See docs/specs/onboarding-first-value-copy.ears.md (FVC-*).

import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LIBRARY_EXERCISE_COUNT } from '@/features/exercises/ExerciseMenu'
import { BeatFirstLight } from '@/features/onboarding/beats/BeatFirstLight'
import { BeatFork } from '@/features/onboarding/beats/BeatFork'
import { BeatMap } from '@/features/onboarding/beats/BeatMap'
import { BeatSky } from '@/features/onboarding/beats/BeatSky'
import { BeatTwin } from '@/features/onboarding/beats/BeatTwin'
import * as COPY from '@/features/onboarding/copy'
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

/** What the browser has decided about the mic, and what the mic hears. */
const mic = vi.hoisted(() => ({
  permission: 'granted' as string,
  level: 0,
  /** When false, a take never ends: the screen stays on "Hold it". */
  takesEnd: true,
  /** When false, the mic never opens: the screen stays on "One moment". */
  opens: true,
}))

vi.mock('@/lib/jam/media-errors', () => ({
  micPermissionState: (): Promise<string> => Promise.resolve(mic.permission),
}))

// jsdom cannot draw: the mic beat's stage is left out.
vi.mock('@/features/mic-check/MicCheckStage', () => ({
  MicCheckStage: () => null,
}))

vi.mock('@/lib/voice-session', () => ({
  createVoiceSession: (): VoiceSession => {
    let open = false
    return {
      open: (): Promise<OpenResult> => {
        if (!mic.opens) return new Promise<OpenResult>(() => {})
        open = true
        return Promise.resolve({ ok: true } as OpenResult)
      },
      probe: (): Promise<ProbeResult> => Promise.resolve('ok' as ProbeResult),
      arm: (): void => {},
      record: (): Promise<PitchFrame[]> =>
        mic.takesEnd
          ? Promise.resolve(recorded())
          : new Promise<PitchFrame[]>(() => {}),
      latest: () => null,
      latestSmoothed: () => null,
      level: (): number => mic.level,
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

afterEach(() => {
  cleanup()
  mic.permission = 'granted'
  mic.level = 0
  mic.takesEnd = true
  mic.opens = true
  vi.useRealTimers()
})

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

/** "We" doing the listening: the first note's old voice, now Merc's. */
const WE_LISTEN =
  /\bwe\b[^.]*\b(hear|heard|listen|listens|listening|record|recording)\b/i

const EM_DASH = '—'

/** Beat 2 at its ask screen, once the browser's answer has landed. */
async function askScreen(permission: string): Promise<HTMLElement> {
  mic.permission = permission
  const { container } = render(() => (
    <BeatFirstLight onHeard={noop} onContinue={noop} onDenied={noop} />
  ))
  const label =
    permission === 'granted' ? 'Start listening' : 'Allow microphone'
  await waitFor(() => {
    expect(container.querySelector('button')?.textContent).toBe(label)
  })
  return container
}

/** Beat 2 waiting for a voice: the meter is live, no take has started. */
async function waitingScreen(level: number): Promise<HTMLElement> {
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame'],
  })
  mic.level = level
  const container = await askScreen('granted')
  fireEvent.click(container.querySelector('button') as HTMLButtonElement)
  await vi.advanceTimersByTimeAsync(100)
  return container
}

/**
 * Everything a screen says, the shared microphone help panel
 * (MicTroubleshooting, a closed <details> also used by Challenges)
 * included: its one em dash went in the follow-up to PR 977.
 */
function ownText(container: HTMLElement): string {
  return container.textContent ?? ''
}

/** Every string in the swappable copy, with the gift at five credits. */
function everyCopyLine(): string[] {
  return Object.values(COPY).map((line) =>
    typeof line === 'function' ? line(5) : line,
  )
}

describe('beat 2 — Merc is the one listening', () => {
  // FVC-11
  it('names Merc on the ask when the microphone is already allowed', async () => {
    const screen = await askScreen('granted')

    expect(screen.querySelector('h1')?.textContent).toBe(
      COPY.FIRST_LIGHT_HEADLINE,
    )
    expect(screen.textContent).toContain(
      `${COPY.FIRST_LIGHT_ASK_ALLOWED} ${COPY.FIRST_LIGHT_PRIVACY}`,
    )
    expect(screen.textContent).not.toMatch(WE_LISTEN)
  })

  // FVC-11
  it('names Merc on the ask before the browser has asked for the mic', async () => {
    const screen = await askScreen('prompt')

    expect(screen.textContent).toContain(
      `${COPY.FIRST_LIGHT_ASK} ${COPY.FIRST_LIGHT_PRIVACY}`,
    )
    expect(screen.textContent).not.toMatch(WE_LISTEN)
  })

  // FVC-11
  it('says Merc can hear you once the meter reads a voice', async () => {
    // A level over the "that's you" line and under the take's onset bar, so
    // the meter shows the voice and no take starts.
    const screen = await waitingScreen(0.008)

    expect(screen.textContent).toContain(COPY.FIRST_LIGHT_AUTO_START)
    expect(screen.textContent).toContain(COPY.FIRST_LIGHT_METER_LIVE)
    expect(screen.textContent).not.toMatch(WE_LISTEN)
  })

  // FVC-11
  it('says Merc heard the note, and that it lit the first star', async () => {
    recorded.mockReturnValue(tone(220))
    const screen = await askScreen('granted')
    fireEvent.click(screen.querySelector('button') as HTMLButtonElement)
    const startNow = await waitFor(() => {
      const button = [...screen.querySelectorAll('button')].find(
        (b) => b.textContent === 'Start the take now',
      )
      expect(button).toBeDefined()
      return button as HTMLButtonElement
    })

    fireEvent.click(startNow)

    await waitFor(() => {
      expect(screen.textContent).toContain(COPY.FIRST_LIGHT_HEARD)
    })
    expect(screen.textContent).toContain(COPY.FIRST_LIGHT_HEARD_EYEBROW)
    expect(screen.textContent).not.toMatch(WE_LISTEN)
  })

  // FVC-12
  it('says where the sound stays, and never mentions an upload', () => {
    expect(COPY.FIRST_LIGHT_PRIVACY).toMatch(/stays on this device/)
    for (const line of everyCopyLine()) {
      expect(line, line).not.toMatch(/upload/i)
    }
  })

  // FVC-13
  it('keeps the em dash out of every swappable line', () => {
    for (const line of everyCopyLine()) {
      expect(line, line).not.toContain(EM_DASH)
    }
  })

  // FVC-13
  it('keeps the em dash off every screen of the first note', async () => {
    // Arrange: the ask, the live meter, a take in progress, and the
    // blocked microphone, each as the visitor would see it.
    mic.takesEnd = false
    const waiting = await waitingScreen(0.008)
    const seen = [ownText(waiting)]
    fireEvent.click(
      [...waiting.querySelectorAll('button')].find(
        (b) => b.textContent === 'Start the take now',
      ) as HTMLButtonElement,
    )
    await vi.advanceTimersByTimeAsync(0)
    seen.push(ownText(waiting))
    cleanup()
    vi.useRealTimers()

    // Act
    mic.opens = false
    const opening = await askScreen('prompt')
    seen.push(ownText(opening))
    fireEvent.click(opening.querySelector('button') as HTMLButtonElement)
    await waitFor(() => {
      expect(opening.textContent).toContain('One moment')
    })
    seen.push(ownText(opening))
    cleanup()
    mic.permission = 'denied'
    const { container } = render(() => (
      <BeatFirstLight onHeard={noop} onContinue={noop} onDenied={noop} />
    ))
    await waitFor(() => {
      expect(container.textContent).toContain('site settings')
    })
    seen.push(ownText(container))

    // Assert
    expect(seen[1]).toContain('Hold it')
    expect(seen.filter((text) => text.includes(EM_DASH))).toEqual([])
  })
})

/** "We", "we'll", "we've" and friends: never the one who hears the singer. */
const WE = /\bwe\b|\bwe'/i

// Follow-up to PR 977 (owner, phone test 11 Oct 2026): whoever hears the
// singer is Merc, on every beat, not only the first note.
describe('Merc is the listener across the flow', () => {
  // FVC-17
  it('says Merc names the note on the welcome', () => {
    const { container } = render(() => <BeatSky onContinue={noop} />)

    const promises = container.querySelector('ul')?.textContent ?? ''

    expect(promises).toContain('Merc tells you which note it was')
    expect(promises).not.toMatch(WE)
  })

  // FVC-17
  it('says Merc cannot hear you on the blocked-mic screen', async () => {
    mic.permission = 'denied'
    const { container } = render(() => (
      <BeatFirstLight onHeard={noop} onContinue={noop} onDenied={noop} />
    ))

    await waitFor(() => {
      expect(container.textContent).toContain('site settings')
    })

    expect(container.querySelector('h1')?.textContent).toBe(
      "Merc can't hear you yet",
    )
    expect(container.textContent).not.toMatch(WE)
  })
})

/** A twin worth showing: two octaves, steady, with the match sung. */
const TWIN_RESULT: MirrorResult = {
  range: {
    lowMidi: 45,
    highMidi: 69,
    lowNote: 'A2',
    highNote: 'A4',
    semitones: 24,
    qualifyingMidis: [],
    voiceHint: 'Baritone',
  },
  accuracy: { score: 74, takes: [], scoopMedianMs: null },
  steadiness: {
    referenceCents: 0,
    referenceNote: 'A3',
    driftCentsPerSec: 0,
    wobbleSdCents: 12,
    vibrato: null,
    score: 82,
    voicedSeconds: 5,
  } as SteadinessResult,
}

describe('beat 5 — the twin', () => {
  // FVC-17
  it('says what Merc heard when there is no range to match a twin to', () => {
    const { container } = render(() => (
      <BeatTwin result={{ ...TWIN_RESULT, range: null }} onContinue={noop} />
    ))

    expect(container.querySelector('h1')?.textContent).toBe(
      "Here's what Merc heard",
    )
    expect(container.textContent).not.toMatch(WE)
  })

  // FVC-14
  it.each<[boolean, string, string]>([
    [false, COPY.TWIN_NEXT, COPY.TWIN_NEXT_PLAN],
    [true, COPY.TWIN_NEXT_PLAN, COPY.TWIN_NEXT],
  ])(
    'with the plan due: %s, says "%s" and not "%s", with no em dash',
    (planDue, line, other) => {
      const { container } = render(() => (
        <BeatTwin result={TWIN_RESULT} planDue={planDue} onContinue={noop} />
      ))

      expect(container.textContent).toContain(line)
      expect(container.textContent).not.toContain(other)
      expect(container.textContent).not.toContain(EM_DASH)
    },
  )

  // FVC-15
  it("puts its numbers on one stat card, drawn from the singer's glides", () => {
    const { container } = render(() => (
      <BeatTwin
        result={TWIN_RESULT}
        strip={[45.5, 52, 60, 68.5, 61, 53, 46]}
        onContinue={noop}
      />
    ))

    expect(container.querySelectorAll('[data-stat-card]')).toHaveLength(1)
    expect(container.querySelector('[data-ridge-line]')).not.toBeNull()
    expect(
      [...container.querySelectorAll('[data-stat] [data-value]')].map(
        (value) => value.textContent,
      ),
    ).toEqual(['24', '82', '74'])
  })

  // On a phone the buttons are pinned to the bottom of the frame, and the
  // line a share says back lands under them: it has to be scrolled to.
  it('brings the line a share says back into view', async () => {
    const scrolled: Element[] = []
    const scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this)
    })
    Element.prototype.scrollIntoView = scrollIntoView
    const onShare = (): Promise<string> =>
      Promise.resolve('Card saved. Link copied.')
    try {
      const { container, getByRole } = render(() => (
        <BeatTwin result={TWIN_RESULT} onShare={onShare} onContinue={noop} />
      ))

      fireEvent.click(getByRole('button', { name: 'Share now' }))

      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1))
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
      expect(scrolled[0]?.textContent).toBe('Card saved. Link copied.')
      expect(container.contains(scrolled[0] ?? null)).toBe(true)
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
    }
  })
})

// Since 11 Oct 2026 only the returning singer's fork says the note back:
// the first-run Fork is one question and one button (owner decision V2),
// and beat 2 has just named the note on the screen before it.
describe('beat 3 — the note we heard, said back', () => {
  // FVC-1
  it('says "an" before a vowel-sound note name', () => {
    expect(forkText('A3', 1)).toContain('You sang an A3.')
    expect(forkText('E4', 1)).toContain('You sang an E4.')
    expect(forkText('F2', 1)).toContain('You sang an F2.')
  })

  // FVC-2
  it('keeps "a" before every other note name', () => {
    expect(forkText('G3', 1)).toContain('You sang a G3.')
    expect(forkText('C4', 1)).toContain('You sang a C4.')
    expect(forkText('B3', 1)).toContain('You sang a B3.')
  })

  // FVC-3
  it('leaves the note out of the first-run fork, which asks its one question', () => {
    const text = forkText('A3')

    expect(text).not.toContain('You sang')
    expect(text).toContain('Which legend has a range like yours?')
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
    // stage: …"), never straight into an instruction.
    for (const room of ROOMS) {
      expect(room.line, `${room.id} should open with an article`).toMatch(
        /^(A|An|The|Your)\b/,
      )
    }
  })

  // FVC-10
  it('joins every room line without an em dash', () => {
    // The owner's product voice: a colon or a full stop, never an em dash,
    // in visible copy.
    for (const room of ROOMS) {
      expect(room.line, room.id).not.toContain('\u2014')
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
    // The library's own cards, not EXERCISE_HELP: that covers every
    // exercise type, including the phone app's Long note, which the library
    // does not list. This card said "fourteen" through four additions.
    const drills = LIBRARY_EXERCISE_COUNT
    const word = NUMBER_WORDS[drills - 10]
    expect(word, `add ${drills} to NUMBER_WORDS`).toBeDefined()

    expect(roomById('exercises').line).toContain(`${word ?? ''} short drills`)
  })
})
