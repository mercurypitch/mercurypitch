// ============================================================
// Games loader — configure this host before the game screen can warm pitch
// ============================================================

import { expect, it, vi } from 'vitest'

const gate = vi.hoisted(() => {
  let release = (): void => {}
  const ready = new Promise<void>((done) => {
    release = done
  })
  return { ready, release, events: [] as string[] }
})
vi.mock('@irchiinnuss/audio-io', () => ({
  configureInputDevice: (options: { storageKey: string }) => {
    gate.events.push(`input:${options.storageKey}`)
  },
}))
vi.mock('./glass/pitch-assets', async () => {
  gate.events.push('pitch waiting')
  await gate.ready
  gate.events.push('pitch configured')
  return {}
})
vi.mock('../screens/GamesScreen', () => {
  gate.events.push('screen loaded')
  return { GamesScreen: () => null }
})

it('awaits pitch assets and the app-specific input preference before loading any game', async () => {
  // A relative import deliberately tests the enabled module; the App's alias
  // stays off in its store-build tests.
  const { loadGamesScreen } = await import('./entry')
  const loading = loadGamesScreen!()
  try {
    await vi.waitFor(() => expect(gate.events).toEqual(['pitch waiting']))
  } finally {
    gate.release()
  }
  const screen = await loading
  expect(screen.default).toBeTypeOf('function')
  expect(gate.events).toEqual([
    'pitch waiting',
    'pitch configured',
    'input:beside-cue:input-device',
    'screen loaded',
  ])
})
