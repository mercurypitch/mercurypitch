// Conditional room sources remain owner-bound when callbacks read them after render.
import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createComponent, getOwner } from 'solid-js'
import { afterEach, expect, it, vi } from 'vitest'
import { GuitarNightApp } from './GuitarNightApp'
import type * as RoomModule from './GuitarNightRoom'
import type * as StageModule from './GuitarNightStage'
import type { GuitarNightSongPort } from './song-port'

const captured = vi.hoisted(() => ({
  room: null as (() => unknown) | null,
  stage: null as (() => unknown) | null,
}))

vi.mock('./GuitarNightRoom', async (importOriginal) => {
  const actual = await importOriginal<typeof RoomModule>()
  return {
    ...actual,
    GuitarNightRoom: (props: Parameters<typeof actual.GuitarNightRoom>[0]) => {
      // Deliberately read outside a tracked owner: this is the regression boundary.
      // eslint-disable-next-line solid/reactivity
      captured.room = () => props.backing
      return createComponent(actual.GuitarNightRoom, props)
    },
  }
})

vi.mock('./GuitarNightStage', async (importOriginal) => {
  const actual = await importOriginal<typeof StageModule>()
  return {
    ...actual,
    GuitarNightStage: (
      props: Parameters<typeof actual.GuitarNightStage>[0],
    ) => {
      // RAF reads the actual prop later without a Solid listener or owner.
      // eslint-disable-next-line solid/reactivity
      captured.stage = () => props.source
      return createComponent(actual.GuitarNightStage, props)
    },
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  captured.room = null
  captured.stage = null
  window.history.replaceState(null, '', '/guitar-night')
})

it('reads App backing and Room stage props after await without creating orphan memos', async () => {
  const warn = vi.spyOn(console, 'warn')
  const loadSongPort = async (): Promise<GuitarNightSongPort> => ({
    initialize: async () => undefined,
    completedSongs: () => [],
    openSession: async () => ({ ok: false, code: 'not-found' }),
  })
  render(() => <GuitarNightApp loadSongPort={loadSongPort} />)
  fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Free play' }))
  await waitFor(() => expect(captured.stage).not.toBeNull())
  await Promise.resolve()
  expect(getOwner()).toBeNull()
  // These are actual compiled JSX getters read by RAF and async admission,
  // not a reimplementation of the conditional passed into either component.
  const source = captured.stage!()
  expect(captured.stage!()).toBe(source)
  expect(captured.room!()).toBeNull()
  expect(captured.room!()).toBeNull()
  expect(
    warn.mock.calls.filter((args) =>
      args.some((value) =>
        String(value).includes('computations created outside'),
      ),
    ),
  ).toEqual([])
})
