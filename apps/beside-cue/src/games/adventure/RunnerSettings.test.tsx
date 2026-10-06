// Runner settings lifecycle — real session ownership survives explicit close, setup and interruptions.
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { deferred, flush, runnerSessionHarness, } from '../../../../../packages/glass-game/src/browser/__fixtures__/runner-session'
import type { GlassGameHost } from '../../../../../packages/glass-game/src/host'
import { GAME_APPEARANCE_KEY } from '../../../../../packages/glass-game/src/ui/game-appearance'
import { GameUIProvider } from '../../../../../packages/glass-game/src/ui/GameUI'
import { SongRunnerView } from '../../../../../packages/glass-game/src/ui/SongRunnerView'

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false
      setTimeout(() => this.dispatchEvent(new Event('close')), 0)
    },
  })
})
afterEach(() => vi.restoreAllMocks())

function mountRunner(harness = runnerSessionHarness()) {
  const disposeScene = vi.fn()
  const scene = vi.fn(() => disposeScene)
  const changeNote = vi.fn()
  const exit = vi.fn()
  const host: GlassGameHost = {
    ...harness.host,
    loadProgress: () => null,
    saveProgress: vi.fn(),
    createSound: () => ({
      reference: async () => undefined,
      shatter: vi.fn(),
      dispose: vi.fn(),
    }),
  }
  const view = render(() => (
    <GameUIProvider host={host}>
      <SongRunnerView
        course={harness.course}
        session={harness.session}
        assetUrl={(id) => id}
        comfortableMidi={60}
        comfortableMidiRange={{ minimumMidi: 48, maximumMidi: 72 }}
        onComfortableMidiChange={changeNote}
        onExit={exit}
        mountScene={scene}
      />
    </GameUIProvider>
  ))
  const open = () => {
    const trigger = screen.getByRole('button', { name: 'Open settings' })
    trigger.focus()
    fireEvent.click(trigger)
  }
  const close = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
  return {
    ...view,
    harness,
    scene,
    disposeScene,
    changeNote,
    exit,
    open,
    close,
  }
}

it.each(['close', 'resume', 'escape'] as const)(
  'returns an active run through readiness after the %s gesture without remounting the scene',
  async (gesture) => {
    const harness = runnerSessionHarness()
    await harness.running()
    const view = mountRunner(harness)
    view.open()
    expect(harness.session.state().phase).toBe('paused')
    expect(harness.voices[0]!.stop).toHaveBeenCalledOnce()
    expect(harness.audio[0]!.dispose).toHaveBeenCalledOnce()
    expect(harness.frames.size).toBe(0)
    expect(screen.queryByRole('dialog', { name: 'Course paused' })).toBeNull()
    if (gesture === 'close') view.close()
    else if (gesture === 'resume')
      fireEvent.click(screen.getByRole('button', { name: /^Resume$/ }))
    else
      fireEvent(
        screen.getByRole('dialog', { name: 'Settings' }),
        new Event('cancel', { cancelable: true }),
      )
    await flush()
    expect(harness.session.state().phase).toBe('readiness')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getByTestId('song-runner')).toHaveFocus()
    expect(harness.voices).toHaveLength(2)
    expect(view.scene).toHaveBeenCalledOnce()
    expect(view.disposeScene).not.toHaveBeenCalled()
    harness.ready()
    harness.tick(harness.audio.at(-1)!.anchor!.audioStartSeconds)
    expect(harness.session.state().phase).toBe('running')
    view.unmount()
    harness.session.dispose()
  },
)

it('keeps before-start idle through tabs, appearance changes and close with no capture', async () => {
  const view = mountRunner()
  view.open()
  fireEvent.click(screen.getByRole('tab', { name: 'Display' }))
  fireEvent.click(screen.getByRole('button', { name: 'Celadon' }))
  fireEvent.click(screen.getByRole('tab', { name: 'Play' }))
  expect(view.harness.session.state().phase).toBe('idle')
  expect(view.harness.host.createVoice).not.toHaveBeenCalled()
  expect(view.harness.host.createRunnerAudio).not.toHaveBeenCalled()
  expect(
    JSON.parse(view.harness.preferences.get(GAME_APPEARANCE_KEY)!),
  ).toMatchObject({ theme: 'dark' })
  expect(view.scene).toHaveBeenCalledOnce()
  view.close()
  await flush()
  expect(view.harness.session.state().phase).toBe('idle')
  expect(screen.getByRole('button', { name: 'Start course' })).toBeVisible()
  expect(view.harness.host.createVoice).not.toHaveBeenCalled()
  view.unmount()
  view.harness.session.dispose()
})

it('stops pending setup playback and closing settings never starts capture', async () => {
  const view = mountRunner()
  view.harness.holdAudioRelease()
  const reference = view.harness.session.hearReference()
  view.open()
  expect(view.harness.session.state()).toMatchObject({
    phase: 'idle',
    referencePlayback: { phase: 'idle' },
  })
  expect(view.harness.audio[0]!.dispose).toHaveBeenCalledOnce()
  view.close()
  view.harness.audio[0]!.release()
  await reference
  expect(view.harness.session.state().phase).toBe('idle')
  expect(view.harness.host.createVoice).not.toHaveBeenCalled()
  view.unmount()
  view.harness.session.dispose()
})

it.each([
  'background',
  'microphone-interrupted',
  'audio-interrupted',
  'renderer-unavailable',
] as const)('keeps %s authoritative after settings closes', async (reason) => {
  const harness = runnerSessionHarness()
  await harness.running()
  const view = mountRunner(harness)
  view.open()
  if (reason === 'background') {
    harness.foreground(false)
    harness.foreground(true)
  } else harness.session.pause(reason)
  // A later paused input control must not re-arm the old resume intent.
  harness.session.pause('manual')
  view.close()
  await flush()
  expect(harness.session.state().phase).toBe('paused')
  expect(harness.voices).toHaveLength(1)
  expect(screen.getByRole('dialog', { name: 'Course paused' })).toBeVisible()
  view.unmount()
  harness.session.dispose()
})

it('leaves checkpoint recovery in charge and keeps its resume action visible after closing', async () => {
  const harness = runnerSessionHarness()
  await harness.running()
  harness.courseTick(2)
  expect(harness.session.state().phase).toBe('recovering')
  const view = mountRunner(harness)
  view.open()
  fireEvent.click(screen.getByRole('tab', { name: 'Play' }))
  expect(screen.queryByRole('button', { name: 'Change note' })).toBeNull()
  view.close()
  await flush()
  expect(harness.session.state().phase).toBe('recovering')
  expect(
    screen.getByRole('button', { name: 'Resume from checkpoint' }),
  ).toBeVisible()
  expect(harness.voices).toHaveLength(1)
  view.unmount()
  harness.session.dispose()
})

it('returns Change note to the existing closed-capture setup without resuming', async () => {
  const harness = runnerSessionHarness()
  await harness.running()
  const view = mountRunner(harness)
  view.open()
  fireEvent.click(screen.getByRole('tab', { name: 'Play' }))
  fireEvent.click(screen.getByRole('button', { name: 'Change note' }))
  await flush()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(harness.session.state().phase).toBe('paused')
  expect(screen.getByRole('slider', { name: 'Comfortable note' })).toHaveFocus()
  fireEvent.change(screen.getByRole('slider', { name: 'Comfortable note' }), {
    target: { value: '62' },
  })
  expect(view.changeNote).toHaveBeenCalledWith(62)
  expect(harness.voices).toHaveLength(1)
  view.unmount()
  harness.session.dispose()
})

it('cancels an unfinished start and ignores its late microphone completion after close', async () => {
  const harness = runnerSessionHarness()
  const permission = deferred<undefined>()
  harness.setPermission(permission.promise)
  const oldStart = harness.session.start()
  const view = mountRunner(harness)
  view.open()
  harness.setPermission(Promise.resolve())
  view.close()
  await flush()
  expect(harness.session.state().phase).toBe('readiness')
  permission.resolve(undefined)
  await oldStart
  expect(harness.session.state().phase).toBe('readiness')
  expect(harness.voices).toHaveLength(2)
  expect(harness.voices[0]!.stop).toHaveBeenCalledOnce()
  expect(harness.voices[1]!.stop).not.toHaveBeenCalled()
  view.unmount()
  harness.session.dispose()
})
