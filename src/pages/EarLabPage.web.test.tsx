// ============================================================
// The Ear Lab on the web: Merc's bench, as the web build has it
// (EAR_LAB_WITH_MERC and WEB_ROOMS both on, owner, 15 Nov 2026).
//
//   - The tab is Merc's bench, and the page gives Merc's room a layer
//     over the web's tab bar and voice pill.
//   - The bench's Ear rooms row lists the rooms the web opens, free, and
//     a card opens the room in the web's frame over the tab; Back comes
//     back to the bench.
//   - A drill asked for on a lesson's set opens in the room on the set,
//     and leaving the room forgets it.
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { EarStageProps } from '@/features/ear-lab/EarStage'
import type { AudioEngine } from '@/lib/audio-engine'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import type * as NativeBuild from '@/lib/native-build'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { resetEarLabStore } from '@/stores/ear-lab-store'
import { startEarDrill } from '@/stores/ui-store'
import { EarLabPage } from './EarLabPage'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  EAR_LAB_WITH_MERC: true,
  WEB_ROOMS: true,
}))
// jsdom has no WebGL: Merc is his still.
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof GpuGateModule>()),
  canRunLiveMerc: (): boolean => false,
}))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(),
  installAudioUnlock: vi.fn(),
  activateAudioPlayback: vi.fn(async () => undefined),
}))
// The room the drill hands its stage to: what it was opened on, and Close.
vi.mock('@/features/ear-lab/stage-switch', () => ({
  EarStage: (props: EarStageProps) => (
    <section data-testid="ear-stage" data-ear-drill={props.drillId}>
      {props.console?.()}
      <button type="button" onClick={() => props.onBack()}>
        Close
      </button>
    </section>
  ),
}))
// The web's frame for a room, as the Exercises tab opens it.
vi.mock('@/features/exercises/rooms/WebRoomHost', () => ({
  default: (props: { id: string; onBack: () => void }) => (
    <div data-testid="web-room" data-room={props.id}>
      <button type="button" onClick={() => props.onBack()}>
        Back
      </button>
    </div>
  ),
}))

const engine = {
  init: vi.fn(async () => undefined),
  resume: vi.fn(async () => undefined),
  getAudioContext: () => null,
  getVolume: () => 0.8,
  setToneTrim: vi.fn(),
  playTone: vi.fn(async () => undefined),
  playChord: vi.fn().mockResolvedValue(undefined),
  stopTone: vi.fn(),
}

/** The bench's chunk loads lazily, as on the web: given time to. */
const LOAD = { timeout: 15_000 }

function renderPage(): void {
  render(() => (
    <EngineContext.Provider
      value={{
        audioEngine: engine as unknown as AudioEngine,
        playbackRuntime: {} as PlaybackRuntime,
        practiceEngine: {} as PracticeEngine,
        ready: () => true,
      }}
    >
      <EarLabPage />
    </EngineContext.Provider>
  ))
}

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
})

afterEach(() => {
  cleanup()
})

describe('the Ear Lab on the web', { timeout: 30_000 }, () => {
  it("is Merc's bench, with his room's layer over the web's bars", async () => {
    renderPage()

    expect(await screen.findByTestId('merc-bench', {}, LOAD)).toBeTruthy()
    expect(screen.queryByTestId('ear-session-bar')).toBeNull()
    const page = document.getElementById('ear-lab-page')
    expect(page?.style.getPropertyValue('--room-layer')).toBe(
      'var(--z-stage, 450)',
    )
  })

  it('opens the Ear rooms the web has over the tab, and Back comes back', async () => {
    renderPage()
    const row = await screen.findByTestId('ear-rooms-row', {}, LOAD)

    // The web's three, free: no First note, no Premium tag.
    const cards = within(row).getAllByTestId('ear-rooms-card')
    expect(cards.map((card) => card.dataset.exercise)).toEqual([
      'home-note-lighthouse',
      'leap-cliffs',
      'harmony-lake',
    ])
    expect(within(row).queryByText('Premium')).toBeNull()

    const leap = cards[1] as HTMLElement
    leap.focus()
    fireEvent.click(leap)
    const room = await screen.findByTestId('web-room', {}, LOAD)
    expect(room.dataset.room).toBe('leap-cliffs')

    // The bench stayed under the room: the focus goes back to the card.
    within(room).getByRole('button', { name: 'Back' }).focus()
    fireEvent.click(within(room).getByRole('button', { name: 'Back' }))
    expect(screen.queryByTestId('web-room')).toBeNull()
    expect(screen.getByTestId('merc-bench')).toBeTruthy()
    expect(document.activeElement).toBe(leap)
  })

  it("opens a lesson's set in Merc's room, and forgets it as the room closes", async () => {
    startEarDrill('leap', ['leap:P4', 'leap:TT', 'leap:P5', 'leap:P8'])
    renderPage()

    const room = screen.getByTestId('ear-stage')
    expect(room.dataset.earDrill).toBe('leap')
    expect(room.textContent).toContain('Only P4, TT, P5 and P8 this time')

    fireEvent.click(within(room).getByRole('button', { name: 'Close' }))
    expect(await screen.findByTestId('merc-bench', {}, LOAD)).toBeTruthy()

    // Leap again, from Shape's sheet: whole.
    fireEvent.click(
      screen
        .getAllByTestId('merc-station')
        .find((tile) => tile.dataset.faculty === 'shape') as HTMLElement,
    )
    const leap = (await screen.findAllByTestId('merc-station-row')).find(
      (row) => row.textContent?.includes('Leap'),
    )
    fireEvent.click(leap as HTMLElement)

    const again = screen.getByTestId('ear-stage')
    expect(again.dataset.earDrill).toBe('leap')
    expect(again.textContent).not.toContain('Only P4')
  })
})
