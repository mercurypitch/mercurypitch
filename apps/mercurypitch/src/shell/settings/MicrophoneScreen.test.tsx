// ============================================================
// The Microphone screen: the input, its level, its timing, its room
// ============================================================
//
// S6 step 8 (mock 7a to 7c). Which input is in use and in what format, a
// live peak, the latency with the day it was measured, the room-noise
// preset, and the wizard in a sheet with the phone's own first paragraph.
// The microphone opens on arrival only on a phone that has granted it
// before; otherwise one tap asks. Refused, the screen says so first and
// sends the singer to the one place that can change it.

import { onAppState, openAppSettings, } from '@irchiinnuss/mobile-runtime/platform'
import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { autoCalibrateSensitivity } from '@/features/mic-feedback/auto-calibrate'
import { setSingMicGranted } from '@/features/sing-room/sing-room-settings'
import { setMicLatencyByDevice } from '@/stores/mic-latency-store'
import { applySensitivityPreset } from '@/stores/settings-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { pushed, resetRunShell } from '../run-shell-store'
import { latencyMeasuredAt, recordLatencyMeasured, resetLatencyMeasured, } from './latency-measured'
import { closeLatencySheet, latencySheetOpen, resetLatencySheet, } from './latency-sheet'
import type * as LevelCheckModule from './level-check'
import type { InputFacts, LevelCheck, LevelCheckState } from './level-check'
import { FLOOR_DB } from './level-check'
import { MicrophoneScreen } from './MicrophoneScreen'

const holder = vi.hoisted(() => ({
  check: null as LevelCheck | null,
  opensAs: 'live' as string,
}))
const wizard = vi.hoisted(() => ({
  component: null as null | ((props: WizardProps) => JSX.Element),
}))

vi.mock('./level-check', async (importOriginal) => ({
  ...(await importOriginal<typeof LevelCheckModule>()),
  createLevelCheck: () => holder.check,
}))
vi.mock('@irchiinnuss/mobile-runtime/platform', () => ({
  openAppSettings: vi.fn(async () => true),
  onAppState: vi.fn(() => () => undefined),
}))
vi.mock('@/features/mic-feedback/auto-calibrate', () => ({
  autoCalibrateSensitivity: vi.fn(async () => 'home'),
}))
vi.mock('@/features/mic-feedback/MicLatencyWizard', () => ({
  MicLatencyWizard: (props: WizardProps) => wizard.component?.(props),
}))

interface WizardProps {
  intro?: JSX.Element
  onClose: () => void
  onApplied?: (ms: number) => void
}

/** The wizard as the sheet sees it: its words, and an answer to apply. */
function FakeWizard(props: WizardProps): JSX.Element {
  return (
    <div data-testid="latency-wizard">
      <p>{props.intro}</p>
      <button
        type="button"
        onClick={() => {
          props.onApplied?.(18)
          props.onClose()
        }}
      >
        Use this
      </button>
    </div>
  )
}

wizard.component = FakeWizard

const FACTS: InputFacts = {
  label: 'iPhone Microphone',
  sampleRate: 48_000,
  channels: 1,
}

interface FakeCheck extends LevelCheck {
  start: ReturnType<typeof vi.fn> & (() => Promise<void>)
  stop: ReturnType<typeof vi.fn> & (() => void)
}

function fakeCheck(): FakeCheck {
  const [state, setState] = createSignal<LevelCheckState>('idle')
  const [input, setInput] = createSignal<InputFacts | null>(null)
  const [peak, setPeak] = createSignal(FLOOR_DB)
  const [level, setLevel] = createSignal(0)
  return {
    state,
    input,
    peak,
    level,
    rms: () => 0.02,
    start: vi.fn(async () => {
      const next = holder.opensAs as LevelCheckState
      setState(next)
      if (next === 'live') {
        setInput(FACTS)
        setPeak(-9)
        setLevel(0.85)
      }
    }),
    stop: vi.fn(() => {
      setState('idle')
    }),
  }
}

let view: RenderedShell | null = null
let check: FakeCheck

function text(): string {
  return view?.container.textContent ?? ''
}

function row(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-settings-row="${id}"]`)
}

function press(testId: string): void {
  document
    .querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)
    ?.click()
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

async function open(): Promise<void> {
  view = renderShell(() => <MicrophoneScreen />)
  await settle()
}

beforeEach(() => {
  localStorage.clear()
  resetLatencyMeasured()
  resetLatencySheet()
  resetRunShell()
  setMicLatencyByDevice({})
  applySensitivityPreset('home')
  setSingMicGranted(true)
  holder.opensAs = 'live'
  check = fakeCheck()
  holder.check = check
  vi.mocked(openAppSettings).mockClear()
  vi.mocked(onAppState).mockClear()
  vi.mocked(autoCalibrateSensitivity).mockClear()
})

afterEach(() => {
  view?.unmount()
  view = null
  resetLatencySheet()
  resetRunShell()
  setMicLatencyByDevice({})
})

describe('the input and its level', () => {
  it('opens on arrival on a phone that granted the microphone before, and names the input (7a)', async () => {
    await open()

    expect(check.start).toHaveBeenCalledTimes(1)
    expect(text()).toContain('iPhone Microphone')
    expect(text()).toContain('In use')
    expect(text()).toContain('48 kHz · mono · access allowed')
    expect(text()).toContain('Say something at singing volume.')
    expect(text()).toContain('Peak −9 dB')
    expect(
      document
        .querySelector('[data-testid="mic-meter"]')
        ?.getAttribute('aria-label'),
    ).toBe('Input level, peaking at minus 9 decibels')
  })

  it('asks before it opens on a phone that never granted it', async () => {
    setSingMicGranted(false)
    await open()
    const before = check.start.mock.calls.length

    press('mic-check-start')
    await settle()

    expect(before).toBe(0)
    expect(check.start).toHaveBeenCalledTimes(1)
    expect(text()).toContain('Peak −9 dB')
  })

  it('hands the microphone back when the screen goes', async () => {
    await open()

    view?.unmount()
    view = null

    expect(check.stop).toHaveBeenCalled()
  })
})

describe('with the microphone refused (7c)', () => {
  it('says so first and sends the singer to Settings', async () => {
    holder.opensAs = 'denied'
    await open()

    press('mic-open-settings')

    const note = document.querySelector('[data-testid="mic-denied"]')
    expect(note?.textContent).toContain('Microphone access is off.')
    expect(openAppSettings).toHaveBeenCalledTimes(1)
    expect(row('mic-input')?.textContent).toContain('Not available')
    expect(row('mic-latency')).not.toBeNull()
  })

  it('looks again when the singer comes back from Settings', async () => {
    holder.opensAs = 'denied'
    await open()
    const onReturn = vi.mocked(onAppState).mock.calls[0]?.[0]
    holder.opensAs = 'live'

    onReturn?.('active')
    await settle()

    expect(check.start).toHaveBeenCalledTimes(2)
    expect(document.querySelector('[data-testid="mic-denied"]')).toBeNull()
    expect(text()).toContain('iPhone Microphone')
  })
})

describe('timing', () => {
  it('says the latency is not measured yet, and offers to measure it', async () => {
    await open()

    expect(row('mic-latency')?.textContent).toContain('Not measured')
    expect(
      document.querySelector('[data-testid="latency-measure"]')?.textContent,
    ).toBe('Measure latency')
  })

  it('shows the latency with the day it was measured', async () => {
    setMicLatencyByDevice({ default: 18 })
    recordLatencyMeasured(new Date(2026, 8, 21, 12))

    await open()

    expect(row('mic-latency')?.textContent).toContain('18 ms')
    expect(row('mic-latency')?.textContent).toContain(
      'Measured 21 September 2026',
    )
    expect(
      document.querySelector('[data-testid="latency-measure"]')?.textContent,
    ).toBe('Measure latency again')
  })

  it("opens the wizard in a sheet, in the phone's words, with the level check stepped aside (7b)", async () => {
    await open()

    press('latency-measure')
    await settle()
    const words =
      document.querySelector('[data-testid="latency-wizard"]')?.textContent ??
      ''
    const stoppedWhileUp = check.stop.mock.calls.length
    closeLatencySheet()
    await settle()

    expect(latencySheetOpen()).toBe(false)
    expect(words).toContain('Your phone takes a moment to play a sound')
    expect(words).not.toContain('blames you')
    expect(stoppedWhileUp).toBeGreaterThan(0)
    expect(check.start).toHaveBeenCalledTimes(2)
  })

  it('keeps the day a measurement is applied', async () => {
    await open()
    press('latency-measure')
    await settle()

    const apply = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === 'Use this',
    )
    apply?.click()

    expect(latencyMeasuredAt()).not.toBeNull()
    expect(latencySheetOpen()).toBe(false)
  })
})

describe('the room', () => {
  it('names the room-noise preset and pushes its choices', async () => {
    await open()

    row('mic-room-noise')?.click()

    expect(row('mic-room-noise')?.textContent).toContain('Home')
    expect(pushed()).toBe('room-noise')
  })

  it("auto-calibrates from the level check's own reading, only while it is live", async () => {
    await open()

    row('mic-auto-calibrate')?.querySelector('button')?.click()
    await settle()
    const getLevel = vi.mocked(autoCalibrateSensitivity).mock.calls[0]?.[0]

    expect(getLevel?.()).toBe(0.02)
  })

  it('offers no auto-calibrate while the microphone is closed', async () => {
    setSingMicGranted(false)
    await open()

    expect(
      row('mic-auto-calibrate')?.querySelector<HTMLButtonElement>('button')
        ?.disabled,
    ).toBe(true)
  })
})
