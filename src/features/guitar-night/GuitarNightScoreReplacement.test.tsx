// Score replacement ends the old rehearsal lifetime without resetting same-song track choices.
import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, expect, it, vi } from 'vitest'
import type { GuitarRoomBand } from '@/features/guitar/backing/guitar-room-band'
import { GuitarNightApp } from './GuitarNightApp'
import type { GuitarNightReferencePort, GuitarNightReferenceSource, GuitarNightReferenceSummary, } from './reference-port'
import { openGuitarNightReference, suggestReferenceInstrument, } from './reference-port'
import type { GuitarNightSongPort } from './song-port'
import * as scoreController from './useGuitarNightScoreRoomController'

function source(
  id: string,
  bpm: number,
  midi: number,
): GuitarNightReferenceSource {
  return {
    id,
    name: id,
    bpm,
    scoreTrackId: null,
    tracks: ['Lead', 'Rhythm'].map((name, index) => ({
      id: `track-${index}`,
      name,
      noteCount: 1,
      notes: [{ midi: midi - index, startBeat: 0, duration: 32 }],
    })),
  }
}

const songs = [source('Score A', 90, 64), source('Score B', 150, 72)]
const summary = (
  song: GuitarNightReferenceSource,
): GuitarNightReferenceSummary => ({
  songId: song.id,
  title: song.name,
  importedAt: 1,
  trackCount: song.tracks.length,
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  window.history.replaceState(null, '', '/guitar-night')
})

async function mount() {
  // jsdom has no canvas backend; the browser regression covers the visible stage.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  const controllers: ReturnType<
    typeof scoreController.useGuitarNightScoreRoomController
  >[] = []
  const completions: (() => void)[] = []
  const original = scoreController.useGuitarNightScoreRoomController
  // Exercise the real controller against a deterministic audio-device edge.
  // Native synthesis and scheduled buffers are checked by the browser regression.
  vi.spyOn(
    scoreController,
    'useGuitarNightScoreRoomController',
  ).mockImplementation((options) => {
    let disposed = false
    const graph = {
      context: { currentTime: 10, sampleRate: 48000 },
    } as NonNullable<ReturnType<GuitarRoomBand['getAudioGraph']>>
    const band: GuitarRoomBand = {
      start: async (run) => {
        const completedAtSeconds =
          10 +
          (((run.durationBeats ?? run.exerciseBeats) - (run.startBeat ?? 0)) *
            60) /
            run.tempoBpm
        completions.push(() => run.onComplete?.(completedAtSeconds))
        run.onExerciseStart?.(run.startBeat ?? 0, 10)
        return {
          expectedHitTimesMs: [],
          exerciseStartedAtSeconds: 10,
          completedAtSeconds: null,
        }
      },
      activate: async () => graph,
      stop: () => undefined,
      dispose: async () => {
        disposed = true
      },
      getAudioGraph: () => (disposed ? null : graph),
      setMasterLevel: () => undefined,
      setElectricAmpParameters: () => undefined,
      setMelodyChannelLevel: () => undefined,
      setPercussionTrackAudible: () => undefined,
    }
    const controller = original({ ...options, createBand: () => band })
    if (options.reference() !== null) controllers.push(controller)
    return controller
  })
  const port: GuitarNightReferencePort = {
    listReferences: () => songs.map(summary),
    readSource: (id) => songs.find((song) => song.id === id) ?? null,
    openReference: (id, track, tuning) => {
      const song = songs.find((candidate) => candidate.id === id)
      return song
        ? openGuitarNightReference(song, track, tuning)
        : { ok: false, code: 'not-found' }
    },
    suggestInstrument: (id, track) => {
      const song = songs.find((candidate) => candidate.id === id)
      return song ? suggestReferenceInstrument(song, track) : null
    },
    rememberTrack: () => undefined,
    importReference: async (file) =>
      summary(file.name.startsWith('a.') ? songs[0] : songs[1]),
  }
  const songPort: GuitarNightSongPort = {
    initialize: async () => undefined,
    completedSongs: () => [],
    openSession: async () => ({ ok: false, code: 'not-found' }),
  }
  render(() => (
    <GuitarNightApp
      loadSongPort={() => Promise.resolve(songPort)}
      loadReferencePort={() => Promise.resolve(port)}
    />
  ))
  fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Free play' }))
  await chooseFile('a.gp5')
  fireEvent.click(screen.getByRole('button', { name: /Rehearse this score/ }))
  await screen.findByRole('heading', { name: 'Score A', level: 1 })
  const first = controllers[0]
  first.setCountInBeats(0)
  await first.start()
  expect(first.error()).toBeNull()
  expect(first.displayReference()?.songId).toBe('Score A')
  expect(first.setupLocked()).toBe(true)
  first.pause()
  first.seekSeconds(2)
  return { first, controllers, port, completions }
}

async function chooseFile(name: string) {
  fireEvent.click(screen.getAllByTestId('night-add-music')[0])
  const input = await screen.findByTestId('night-music-file')
  fireEvent.change(input, { target: { files: [new File(['fixture'], name)] } })
  await screen.findByRole('button', { name: /Rehearse this score/ })
}

it.each(['paused', 'complete'])(
  'replaces a %s score and its pinned playback with a new silent rehearsal',
  async (state) => {
    const { first, controllers, completions } = await mount()
    if (state === 'complete') {
      await first.start()
      completions.at(-1)!()
    }
    expect(first.status()).toBe(state)
    const oldHeading = screen.getByRole('heading', {
      name: 'Score A',
      level: 1,
    })
    await chooseFile('b.gp5')

    fireEvent.click(screen.getByRole('button', { name: /Rehearse this score/ }))

    await screen.findByRole('heading', { name: 'Score B', level: 1 })
    expect(oldHeading.isConnected).toBe(false)
    expect(controllers).toHaveLength(2)
    await waitFor(() => expect(first.getAudioGraph()).toBeNull())
    const next = controllers[1]
    expect(next.status()).toBe('quiet')
    expect(next.displayPositionSeconds()).toBe(0)
    expect(next.tempoBpm()).toBe(150)
    expect(next.setupLocked()).toBe(false)
    next.setCountInBeats(0)
    await next.start()
    expect(next.displayReference()?.songId).toBe('Score B')
    expect(next.displayReference()?.notes.map((note) => note.midi)).toEqual([
      72,
    ])
  },
)

it('keeps the room and parked beat when choosing another track of the same song', async () => {
  const { first, controllers } = await mount()
  const heading = screen.getByRole('heading', { name: 'Score A', level: 1 })
  const beat = first.playheadBeat()
  fireEvent.click(screen.getByTestId('guitar-night-session-trigger'))

  fireEvent.click(screen.getByRole('button', { name: /^Rhythm/ }))

  await waitFor(() => expect(first.displayReference()?.trackId).toBe('track-1'))
  expect(controllers).toHaveLength(1)
  expect(heading.isConnected).toBe(true)
  expect(first.status()).toBe('paused')
  expect(first.playheadBeat()).toBe(beat)
})

it('keeps the previous rehearsal and its resume point when the replacement fails', async () => {
  const { first, controllers, port } = await mount()
  const oldHeading = screen.getByRole('heading', { name: 'Score A', level: 1 })
  port.importReference = async () => {
    throw new Error('Invalid Guitar Pro file')
  }
  await chooseFile('bad.gp5')

  fireEvent.click(screen.getByRole('button', { name: /Rehearse this score/ }))

  await screen.findByText('Invalid Guitar Pro file')
  expect(oldHeading.isConnected).toBe(true)
  expect(controllers).toHaveLength(1)
  expect(first.displayReference()?.songId).toBe('Score A')
  expect(first.status()).toBe('paused')
  expect(first.displayPositionSeconds()).toBeCloseTo(2)
})

it('does not replace a rehearsal when a cancelled import finishes later', async () => {
  const { first, controllers, port } = await mount()
  let finish!: (value: ReturnType<typeof summary>) => void
  const pending = new Promise<ReturnType<typeof summary>>((resolve) => {
    finish = resolve
  })
  const importFile = vi.fn(() => pending)
  port.importReference = importFile
  await chooseFile('b.gp5')
  fireEvent.click(screen.getByRole('button', { name: /Rehearse this score/ }))
  await waitFor(() => expect(importFile).toHaveBeenCalledOnce())

  fireEvent.click(
    within(screen.getByTestId('night-music-import')).getByRole('button', {
      name: 'Cancel and return',
    }),
  )
  finish(summary(songs[1]))

  await pending
  await Promise.resolve()
  expect(controllers).toHaveLength(1)
  expect(first.displayReference()?.songId).toBe('Score A')
  expect(first.status()).toBe('paused')
  expect(first.displayPositionSeconds()).toBeCloseTo(2)
})
