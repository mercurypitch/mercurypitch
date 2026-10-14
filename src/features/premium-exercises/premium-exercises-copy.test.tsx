// ============================================================
// The way in to the exercises: its words as they render, and a tripwire
// ============================================================
//
// The decided sentences, asserted on what the row, the picker and the Sing
// options draw and name, not on their source: a reformat or an extracted
// component must not break this, and a broken render must. Then a scan of
// every source in the folder, comments included, for what the product
// voice rules out: em dashes, "upload" (device round 2, R6), the mood
// words, and the British spelling of practice.

import { cleanup, render, screen, within } from '@solidjs/testing-library'
import { readdirSync, readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_COPY as ECHO_DEMO_COPY } from '@/features/echo/demo/demo-cues'
import { DEMO_COPY } from '@/features/long-note/demo/demo-cues'
import { DEMO_COPY as NG_DEMO_COPY } from '@/features/ng-slides/demo/demo-cues'
// Loaded once, here. The options read no stored state, and loading their
// graph fresh inside the test ran past the 5 s timeout under a full run.
// The row and the picker load after seed() below: they read storage as
// they load.
import { SingRoomOptions } from '@/features/sing-room/SingRoomOptions'
import type * as NativeBuild from '@/lib/native-build'
import { catalogueEntry } from './catalogue'

// The Sing options draw their exercises section only in a build with the
// exercises in it.
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  PREMIUM_EXERCISES: true,
}))

/** Repo-relative: vitest runs from the workspace root in either project. */
const FOLDER = 'src/features/premium-exercises'

function sources(): Array<[string, string]> {
  return readdirSync(FOLDER)
    .filter((name) => /\.(ts|tsx|css)$/u.test(name))
    .filter((name) => !name.includes('.test.'))
    .map((name) => [name, readFileSync(`${FOLDER}/${name}`, 'utf8')])
}

const offenders = (pattern: RegExp): string[] =>
  sources()
    .filter(([, text]) => pattern.test(text))
    .map(([name]) => name)

/** Long note's stored state, as a singer's phone would hold it. */
function seed(state: { last?: boolean; best?: boolean; demoSeen?: boolean }) {
  if (state.last === true) {
    localStorage.setItem('mp_last_exercise', 'long-note-lantern')
  }
  localStorage.setItem('pitchperfect_long_note_lantern_note', '57')
  if (state.best === true) {
    localStorage.setItem(
      'pitchperfect_long_note_lantern_bests',
      JSON.stringify({ 57: { inBandSeconds: 9.46, steadiness: 80, at: 1 } }),
    )
  }
  if (state.demoSeen === true) {
    localStorage.setItem('mp_long_note_demo_seen', 'true')
    localStorage.setItem('mp_echo_demo_seen', 'true')
    localStorage.setItem('mp_ng_demo_seen', 'true')
  }
}

async function showRow(): Promise<void> {
  const { ExerciseRow } = await import('./ExerciseRow')
  render(() => (
    <ExerciseRow
      disabled={false}
      onOpen={() => undefined}
      onBrowse={() => undefined}
    />
  ))
}

async function showPicker(): Promise<void> {
  const { ExercisePicker } = await import('./ExercisePicker')
  render(() => (
    <ExercisePicker isOpen close={() => undefined} onPick={() => undefined} />
  ))
}

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

afterEach(() => {
  cleanup()
})

describe('the decided words, as they render', () => {
  it('names Long note and says what it is, on its card', async () => {
    const longNote = catalogueEntry('long-note-lantern')
    expect([longNote?.name, longNote?.line]).toEqual([
      'Long note',
      'Hold one note and fill the lantern with light.',
    ])

    seed({ demoSeen: true })
    await showPicker()
    const card = screen.getByRole('button', { name: /^Long note/u })
    expect(card.textContent).toBe(
      'Long noteSingerHold one note and fill the lantern with light.',
    )
  })

  it('names the lone pill, then the pill and the door', async () => {
    await showRow()
    expect(screen.getByRole('button', { name: 'Exercises' }).textContent).toBe(
      'Exercises',
    )
    cleanup()

    vi.resetModules()
    seed({ last: true, best: true })
    await showRow()
    expect(
      screen.getByRole('button', { name: /Open your last exercise$/u }),
    ).toBe(screen.getByTestId('sing-exercise-pill'))
    expect(screen.getByRole('button', { name: 'All exercises' })).toBe(
      screen.getByTestId('sing-exercise-door'),
    )
  })

  it('titles the sheet, labels its close, and prints the best with its note', async () => {
    seed({ best: true, demoSeen: true })
    await showPicker()

    const sheet = screen.getByRole('dialog', { name: 'Exercises' })
    expect(
      within(sheet).getByRole('heading', { level: 2, name: 'Exercises' }),
    ).toBeTruthy()
    expect(within(sheet).getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(
      screen.getAllByTestId('sing-exercise-meta').map((m) => m.textContent),
    ).toEqual(['Best 9.4 s on A3'])
  })

  it('names the options row', () => {
    const none = (): undefined => undefined
    render(() => (
      <SingRoomOptions
        isOpen
        close={none}
        songName={() => 'Scales'}
        onOpenSong={none}
        onChangeKey={none}
        onChangeScale={none}
        onOctaveShift={none}
        speed={() => 1}
        onSpeedChange={none}
        volume={() => 1}
        onVolumeChange={none}
        metronomeEnabled={() => false}
        onMetronomeToggle={none}
        onAutoCalibrate={none}
        micOnArrival={() => false}
        onMicOnArrivalChange={none}
        perNoteBurn={() => false}
        onPerNoteBurnChange={none}
        onSessionSkip={none}
        onSessionEnd={none}
        onOpenExercises={none}
      />
    ))

    const open = screen.getByTestId('sing-options-exercises')
    const section = open.closest('section') as HTMLElement
    expect(within(section).getByRole('heading', { level: 3 }).textContent).toBe(
      'Exercises',
    )
    expect(open.closest('label')?.textContent).toBe('All exercisesOpen')
  })

  it("tags a card with the demo's own first words", async () => {
    await showPicker()

    expect(
      screen.getAllByTestId('sing-exercise-meta').map((m) => m.textContent),
    ).toEqual([
      'Merc sings it first',
      'Merc sings it first',
      'Merc sings it first',
    ])
    expect(DEMO_COPY.cardLine.startsWith('Merc sings it first')).toBe(true)
    expect(ECHO_DEMO_COPY.cardLine.startsWith('Merc sings it first')).toBe(true)
    expect(NG_DEMO_COPY.cardLine.startsWith('Merc sings it first')).toBe(true)
  })
})

describe('what the product voice keeps out', () => {
  it('has no em dash', () => {
    expect(offenders(/—/u)).toEqual([])
  })

  it('never says upload', () => {
    expect(offenders(/upload/iu)).toEqual([])
  })

  it('uses none of the mood words or the sales promises', () => {
    expect(
      offenders(
        /\b(calm\w*|seamless|effortless|intuitive|delightful|elevate|empower|unlock|journey|reimagine|curated)\b/iu,
      ),
    ).toEqual([])
  })

  it('spells it practice', () => {
    expect(offenders(/practis/iu)).toEqual([])
  })
})
