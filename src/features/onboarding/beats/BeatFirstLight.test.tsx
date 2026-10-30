// ============================================================
// First light hands its live mic level to the sky (owner decision V11),
// and helps a singer it cannot hear
// ============================================================
//
// On main a small Merc on this beat pulsed with the mic level. The beat now
// sits on a painted plate, and the reaction moved into the picture: a glow
// where the star will light follows the voice, and the star lights when
// the note lands. FirstLight draws both; this beat only reports the level
// it already measures for its meter, and reports zero once it stops.
//
// When it hears nothing, the beat says why it may not: after nine silent
// seconds the likely cause takes the instructions' place and the inputs
// open, and a switch of input that opens nothing, or sends nothing, says so.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeMediaDevices } from '@/features/mic-check/fake-capture.fixture'
import { audioInput, fakeMediaDevices, fakeStream, fakeTrack, } from '@/features/mic-check/fake-capture.fixture'
import { micManager } from '@/lib/mic-manager'
import type { OpenResult, ProbeResult, VoiceSession } from '@/lib/voice-session'
import { FIRST_LIGHT_DEAD_EYEBROW, FIRST_LIGHT_DEAD_INPUT, FIRST_LIGHT_NUDGE, FIRST_LIGHT_PICK_FAILED, FIRST_LIGHT_SILENT_PICK, } from '../copy'

const mic = vi.hoisted(() => ({
  level: 0,
  /** What switching to another input reports. */
  pick: 'ok' as ProbeResult,
  /** What the check after opening reports. */
  probe: 'ok' as ProbeResult,
}))

vi.mock('@/lib/jam/media-errors', () => ({
  micPermissionState: (): Promise<string> => Promise.resolve('granted'),
}))

// jsdom cannot draw: the stage's canvas is left out.
vi.mock('@/features/mic-check/MicCheckStage', () => ({
  MicCheckStage: () => null,
}))

vi.mock('@/lib/voice-session', () => ({
  createVoiceSession: (): VoiceSession =>
    ({
      open: (): Promise<OpenResult> =>
        Promise.resolve({ ok: true } as OpenResult),
      probe: (): Promise<ProbeResult> => Promise.resolve(mic.probe),
      arm: (): void => {},
      // A take that never ends: the beat stays on its live meter.
      record: () => new Promise(() => {}),
      latest: () => null,
      latestSmoothed: () => null,
      level: (): number => mic.level,
      context: () => null,
      isOpen: (): boolean => true,
      devices: (): Promise<MediaDeviceInfo[]> => Promise.resolve([]),
      useDevice: (): Promise<ProbeResult> => Promise.resolve(mic.pick),
      close: (): void => {},
    }) as unknown as VoiceSession,
}))

import { BeatFirstLight } from './BeatFirstLight'

const SCARLETT = audioInput('usb', 'Scarlett 4i4 USB', 'focusrite')
const BUILT_IN = audioInput('built-in', 'Built-in Microphone')

let queued: Map<number, FrameRequestCallback>
let nextId: number
let clock: number
let devices: FakeMediaDevices | null

/** Runs the frames asked for so far, as the browser would on a tick. */
function tick(): void {
  const due = [...queued.values()]
  queued.clear()
  for (const callback of due) callback(performance.now())
}

beforeEach(() => {
  mic.level = 0
  mic.pick = 'ok'
  mic.probe = 'ok'
  queued = new Map()
  nextId = 1
  clock = 0
  devices = null
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextId++
    queued.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queued.delete(id))
})

afterEach(() => {
  cleanup()
  devices?.restore()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** The beat on its waiting screen, the inputs listed: "go ahead, sing". */
async function waitingToSing(
  onLevel?: (level: number) => void,
): Promise<{ unmount: () => void }> {
  const { unmount } = render(() => (
    <BeatFirstLight
      onHeard={() => {}}
      onContinue={() => {}}
      onDenied={() => {}}
      onLevel={onLevel}
    />
  ))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Start listening' }),
  )
  await vi.waitFor(() => expect(queued.size).toBe(1))
  return { unmount }
}

/** Opens the list of inputs from the chip that names the one heard. */
async function openInputs(): Promise<void> {
  fireEvent.click(
    await screen.findByRole('button', { name: /^Microphone in use:/ }),
  )
}

/** The list's row that names `name` (the chip above may name it too). */
function rowOf(name: string): HTMLElement {
  const row = screen
    .getAllByText(name)
    .map((element) => element.closest('li'))
    .find((element) => element !== null)
  if (row === undefined || row === null) throw new Error(`no row names ${name}`)
  return row
}

/** The "Use this" on the row that names `name`. */
function useThis(name: string): HTMLElement {
  return within(rowOf(name)).getByRole('button', { name: 'Use this' })
}

describe('First light and the live level', () => {
  it('reports every frame of the live level while it listens', async () => {
    // Arrange
    const onLevel = vi.fn<(level: number) => void>()
    await waitingToSing(onLevel)

    // Act
    mic.level = 0.02
    tick()
    mic.level = 0.05
    tick()

    // Assert
    expect(onLevel.mock.calls.map(([level]) => level)).toEqual([0.02, 0.05])
  })

  it('reports silence when the beat goes, so the glow does not stay lit', async () => {
    // Arrange
    const onLevel = vi.fn<(level: number) => void>()
    const { unmount } = await waitingToSing(onLevel)
    mic.level = 0.05
    tick()

    // Act
    unmount()

    // Assert
    expect(onLevel).toHaveBeenLastCalledWith(0)
  })
})

describe('First light when it hears nothing', () => {
  it('names the likely cause and opens the inputs after nine silent seconds', async () => {
    // Arrange
    devices = fakeMediaDevices([BUILT_IN, SCARLETT])
    await waitingToSing()
    clock = 700
    tick()

    // Act
    clock = 9_100
    tick()

    // Assert
    expect(await screen.findByText(FIRST_LIGHT_NUDGE)).toBeVisible()
    expect(
      await screen.findAllByRole('button', { name: 'Use this' }),
    ).toHaveLength(2)
    expect(
      screen.getByRole('button', { name: 'Continue without the mic' }),
    ).toBeVisible()
  })

  it('sends a switch that opens nothing to the blocked screen, inputs open', async () => {
    // Arrange: the old input closes as the switch starts, and nothing opens.
    devices = fakeMediaDevices([BUILT_IN, SCARLETT])
    vi.spyOn(micManager, 'getStream').mockReturnValue(null)
    await waitingToSing()
    await openInputs()

    // Act
    fireEvent.click(useThis('Built-in Microphone'))

    // Assert
    expect(await screen.findByText(FIRST_LIGHT_PICK_FAILED)).toBeVisible()
    expect(
      screen.getByRole('heading', { name: "Merc can't hear you yet" }),
    ).toBeVisible()
    expect(
      await screen.findAllByRole('button', { name: 'Use this' }),
    ).toHaveLength(2)
  })

  it('opens the inputs, the dead one marked, when the input it opened carries nothing at all', async () => {
    // Arrange: exact zeros, a muted input or one another app has seized.
    mic.probe = 'silent'
    devices = fakeMediaDevices([BUILT_IN, SCARLETT])
    vi.spyOn(micManager, 'getStream').mockReturnValue(
      fakeStream(
        fakeTrack({ label: 'Built-in Microphone', deviceId: 'built-in' }),
      ),
    )
    render(() => (
      <BeatFirstLight
        onHeard={() => {}}
        onContinue={() => {}}
        onDenied={() => {}}
      />
    ))

    // Act
    fireEvent.click(
      await screen.findByRole('button', { name: 'Start listening' }),
    )

    // Assert: a microphone that carries nothing, not a missing one; the
    // input it opened says so where it would say "Listening", and the
    // other one is a tap away.
    expect(
      await screen.findByRole('heading', { name: "Merc can't hear you yet" }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 1 }).previousElementSibling,
    ).toHaveTextContent(FIRST_LIGHT_DEAD_EYEBROW)
    expect(screen.getByText(FIRST_LIGHT_DEAD_INPUT)).toBeVisible()
    await vi.waitFor(() =>
      expect(rowOf('Built-in Microphone')).toHaveTextContent(
        FIRST_LIGHT_DEAD_EYEBROW,
      ),
    )
    expect(rowOf('Built-in Microphone')).not.toHaveTextContent('Listening')
    expect(useThis('Scarlett 4i4 USB')).toBeEnabled()
  })

  it('keeps listening after a pick that sends no sound, and says so on its row', async () => {
    // Arrange
    mic.pick = 'silent'
    devices = fakeMediaDevices([BUILT_IN, SCARLETT])
    const getStream = vi.spyOn(micManager, 'getStream').mockReturnValue(null)
    await waitingToSing()
    await openInputs()
    getStream.mockReturnValue(
      fakeStream(
        fakeTrack({ label: 'Built-in Microphone', deviceId: 'built-in' }),
      ),
    )

    // Act
    fireEvent.click(useThis('Built-in Microphone'))

    // Assert: the row the singer picked is the one heard now, and says
    // that nothing came from it; the screen still waits for a voice.
    await vi.waitFor(() =>
      expect(rowOf('Built-in Microphone')).toHaveTextContent('Listening'),
    )
    expect(rowOf('Built-in Microphone')).toHaveTextContent(
      FIRST_LIGHT_SILENT_PICK,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      "Sing ahh whenever you're ready",
    )
  })
})
