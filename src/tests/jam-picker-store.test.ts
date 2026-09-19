// ── What a room can sing, as one list ────────────────────────────────
// The picker's state used to be JamPanel's. It is a store now because two
// surfaces show it -- the popup and the sidebar -- and the rules below are
// the ones that must hold whichever of them the host is looking at.
//
// The defect that started this: only the FIRST example song was on the
// shelf. Every other one arrived as a library row with no audio behind it
// in this browser, and the room answered "missing its backing track".

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as DemoSongModule from '@/features/karaoke-night/demo-song'
import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import type * as JamSessionSongsModule from '@/lib/jam/jam-session-songs'
import type { JamSong } from '@/lib/jam/jam-song'
import type * as JamStoreModule from '@/stores/jam-store'
import type * as UvrStoreModule from '@/stores/uvr-store'
import type { UvrSession } from '@/stores/uvr-store'
import type { MelodyData } from '@/types'

const loadDemoSongs = vi.fn<() => Promise<DemoSongManifest[]>>()
const getActiveWeekly = vi.fn(async () => null)
const sessions = vi.fn<() => UvrSession[]>(() => [])
const exampleSong = vi.fn<(m: DemoSongManifest) => Promise<JamSong | null>>()
const sessionSong = vi.fn<(s: UvrSession) => Promise<JamSong | null>>()
const selectJamSong = vi.fn<(song: JamSong) => boolean>(() => true)
const selectJamExercise = vi.fn()

vi.mock('@/features/karaoke-night/demo-song', async (original) => ({
  ...(await original<typeof DemoSongModule>()),
  loadDemoSongs: () => loadDemoSongs(),
}))
vi.mock('@/features/challenges/weekly-service', () => ({
  getActiveWeekly: () => getActiveWeekly(),
}))
vi.mock('@/stores/uvr-store', async (original) => ({
  ...(await original<typeof UvrStoreModule>()),
  getAllUvrSessionsReactive: () => sessions(),
}))
vi.mock('@/lib/jam/jam-session-songs', async (original) => ({
  ...(await original<typeof JamSessionSongsModule>()),
  exampleSong: (m: DemoSongManifest) => exampleSong(m),
  sessionSong: (s: UvrSession) => sessionSong(s),
}))
vi.mock('@/stores/jam-store', async (original) => ({
  ...(await original<typeof JamStoreModule>()),
  selectJamSong: (song: JamSong) => selectJamSong(song),
  selectJamExercise: (melody: MelodyData) => selectJamExercise(melody),
}))

const { setJamError, setJamExerciseMelody, setJamSong, setJamState } =
  await import('@/stores/jam-store')
const {
  chooseJamPickerEntry,
  jamExamplesState,
  jamPickerAcceptedPicks,
  jamPickerActiveTargetId,
  jamPickerError,
  jamPickerShelves,
  jamPickingEntryId,
} = await import('@/stores/jam-picker-store')

const manifest = (slug: string, title: string): DemoSongManifest => ({
  slug,
  title,
  artist: 'Josh Woodward',
  attribution: { text: '', url: '', license: '', licenseUrl: '' },
  stems: {
    vocal: `https://stems.example/${slug}/vocal.m4a`,
    instrumental: `https://stems.example/${slug}/instrumental.m4a`,
  },
  durationSec: 240,
})

const EXAMPLES = [
  manifest('karaoke-night', 'Goodbye to Spring'),
  manifest('josephine', "I'll Be Right Behind You, Josephine"),
  manifest('nothing-in-the-dark', 'Nothing in the Dark'),
]

const row = (sessionId: string, name: string): UvrSession =>
  ({
    sessionId,
    status: 'completed',
    progress: 100,
    originalFile: { name, size: 0, mimeType: 'audio/mpeg' },
    createdAt: 1,
  }) as UvrSession

const song = (id: string): JamSong => ({
  id,
  title: 'A song',
  stems: { instrumental: 'https://stems.example/i.m4a' },
  lines: [],
  notes: [],
  durationSec: 240,
  origin: 'url',
})

const shelf = (id: string) => jamPickerShelves().find((s) => s.id === id)
const names = (id: string) => shelf(id)?.entries.map((e) => e.name) ?? []
const settled = () =>
  vi.waitFor(() => expect(jamExamplesState()).not.toBe('loading'))

/** Open a room and wait for the shelves' fetches to land. */
async function openRoom(): Promise<void> {
  setJamState('active')
  await settled()
}

beforeEach(() => {
  setJamState('idle')
  setJamSong(null)
  setJamExerciseMelody(null)
  setJamError(null)
  loadDemoSongs.mockReset().mockResolvedValue(EXAMPLES)
  getActiveWeekly.mockClear()
  sessions.mockReset().mockReturnValue([])
  exampleSong.mockReset()
  sessionSong.mockReset()
  selectJamSong.mockReset().mockReturnValue(true)
  selectJamExercise.mockReset()
})

describe('the example songs shelf', () => {
  it('lists every example, not the one Karaoke Night opens on', async () => {
    await openRoom()
    expect(jamExamplesState()).toBe('ready')
    expect(names('examples')).toEqual([
      'Goodbye to Spring',
      "I'll Be Right Behind You, Josephine",
      'Nothing in the Dark',
    ])
  })

  it('fetches nothing about a song until it is picked', async () => {
    await openRoom()
    expect(exampleSong).not.toHaveBeenCalled()
  })

  it('says so when there are none, and keeps the drills', async () => {
    loadDemoSongs.mockResolvedValue([])
    await openRoom()
    expect(jamExamplesState()).toBe('unavailable')
    expect(names('exercises').length).toBeGreaterThan(0)
  })

  it('survives the list failing outright', async () => {
    loadDemoSongs.mockRejectedValue(new Error('offline'))
    await openRoom()
    expect(jamExamplesState()).toBe('unavailable')
    expect(names('examples')).toEqual([])
  })

  it('is thrown away when the room ends', async () => {
    await openRoom()
    setJamState('idle')
    expect(jamPickerShelves()).toEqual([])
    expect(jamExamplesState()).toBe('loading')
  })

  it('ignores a list that arrives after the room it was for has gone', async () => {
    let arrive: (songs: DemoSongManifest[]) => void = () => {}
    loadDemoSongs.mockReturnValue(
      new Promise<DemoSongManifest[]>((resolve) => {
        arrive = resolve
      }),
    )
    setJamState('active')
    setJamState('idle')
    arrive(EXAMPLES)
    await Promise.resolve()
    await Promise.resolve()
    expect(jamExamplesState()).toBe('loading')
  })
})

describe('your karaoke songs', () => {
  const library = [
    row('karaoke-night-demo', 'Josh Woodward — Goodbye to Spring'),
    row('karaoke-night-demo:josephine', 'Josh Woodward — Josephine'),
    row('my-own-song', 'My rehearsal.mp3'),
  ]

  it('does not list an example a second time', async () => {
    sessions.mockReturnValue(library)
    await openRoom()
    expect(names('own-songs')).toEqual(['My rehearsal'])
  })

  it('keeps an example reachable when its manifest never arrived', async () => {
    // Offline, or parked in the studio: the row is all that is left of it,
    // and sessionSong can still sing it from the row's own addresses.
    sessions.mockReturnValue(library)
    loadDemoSongs.mockResolvedValue([EXAMPLES[0]!])
    await openRoom()
    expect(names('own-songs')).toEqual([
      'Josh Woodward — Josephine',
      'My rehearsal',
    ])
  })
})

describe('picking', () => {
  const exampleEntry = async () => {
    await openRoom()
    return shelf('examples')!.entries[1]!
  }

  it('loads the example that was picked, by its own id', async () => {
    const entry = await exampleEntry()
    exampleSong.mockResolvedValue(song('karaoke-night-demo:josephine'))
    await expect(chooseJamPickerEntry(entry)).resolves.toBe(true)
    expect(exampleSong).toHaveBeenCalledWith(EXAMPLES[1])
    expect(selectJamSong).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'karaoke-night-demo:josephine' }),
    )
    expect(jamPickerError()).toBe('')
  })

  it('never sends the host to Karaoke over an example', async () => {
    // Nothing of an example is kept on the device, so "open it in Karaoke
    // and try again" is an errand that cannot help.
    const entry = await exampleEntry()
    exampleSong.mockResolvedValue(null)
    await expect(chooseJamPickerEntry(entry)).resolves.toBe(false)
    expect(jamPickerError()).toContain('could not be loaded')
    expect(jamPickerError()).not.toContain('Karaoke')
  })

  it('still says what is wrong with a separation whose stems have gone', async () => {
    sessions.mockReturnValue([row('my-own-song', 'My rehearsal.mp3')])
    await openRoom()
    sessionSong.mockResolvedValue(null)
    const entry = shelf('own-songs')!.entries[0]!
    await expect(chooseJamPickerEntry(entry)).resolves.toBe(false)
    expect(jamPickerError()).toBe(
      'My rehearsal is missing its backing track on this device. Open it in Karaoke and try again.',
    )
  })

  it('passes on the reason when the room itself refuses the song', async () => {
    const entry = await exampleEntry()
    exampleSong.mockResolvedValue(song('karaoke-night-demo:josephine'))
    selectJamSong.mockImplementation(() => {
      setJamError('Wait for the song to finish sending.')
      return false
    })
    await expect(chooseJamPickerEntry(entry)).resolves.toBe(false)
    expect(jamPickerError()).toBe('Wait for the song to finish sending.')
  })

  it('survives a read that throws', async () => {
    const entry = await exampleEntry()
    exampleSong.mockRejectedValue(new Error('network'))
    await expect(chooseJamPickerEntry(entry)).resolves.toBe(false)
    expect(jamPickerError()).toContain('could not be loaded')
    expect(jamPickingEntryId()).toBeNull()
  })

  it('marks the row while it loads, and takes no second pick meanwhile', async () => {
    const entry = await exampleEntry()
    let finish: (s: JamSong) => void = () => {}
    exampleSong.mockReturnValue(
      new Promise<JamSong>((resolve) => {
        finish = resolve
      }),
    )
    const first = chooseJamPickerEntry(entry)
    expect(jamPickingEntryId()).toBe(entry.id)
    await expect(chooseJamPickerEntry(entry)).resolves.toBe(false)
    finish(song('karaoke-night-demo:josephine'))
    await expect(first).resolves.toBe(true)
    expect(exampleSong).toHaveBeenCalledOnce()
    expect(jamPickingEntryId()).toBeNull()
  })

  it('counts the picks the room accepted, so an open popup can close on any of them', async () => {
    const entry = await exampleEntry()
    const before = jamPickerAcceptedPicks()
    exampleSong.mockResolvedValueOnce(null)
    await chooseJamPickerEntry(entry)
    expect(jamPickerAcceptedPicks()).toBe(before)
    exampleSong.mockResolvedValueOnce(song('karaoke-night-demo:josephine'))
    await chooseJamPickerEntry(entry)
    expect(jamPickerAcceptedPicks()).toBe(before + 1)
  })

  it('loads a drill straight away', async () => {
    await openRoom()
    const entry = shelf('exercises')!.entries[0]!
    await expect(chooseJamPickerEntry(entry)).resolves.toBe(true)
    expect(selectJamExercise).toHaveBeenCalledOnce()
  })
})

describe('the row that is running', () => {
  it('is the song, by the id its entry carries', async () => {
    await openRoom()
    setJamSong(song('karaoke-night-demo:josephine'))
    expect(jamPickerActiveTargetId()).toBe(
      shelf('examples')!.entries[1]!.targetId,
    )
  })

  it('is the drill when no song is loaded, and nothing in an empty room', async () => {
    await openRoom()
    expect(jamPickerActiveTargetId()).toBeNull()
    const entry = shelf('exercises')!.entries[0]!
    if (entry.kind === 'song') throw new Error('expected a drill')
    setJamExerciseMelody(entry.build())
    expect(jamPickerActiveTargetId()).toBe(entry.targetId)
  })
})
