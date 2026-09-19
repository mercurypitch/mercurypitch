// ── The song list, in the popup and in the sidebar ───────────────────
// One list, three containers. What differs is what the sidebar needs for
// staying open all evening: groups that fold and remember it, and a mark on
// the row the room is running. What must NOT differ is the state -- a song
// that is loading, or the reason one failed, shows wherever the list is.

import { fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as DemoSongModule from '@/features/karaoke-night/demo-song'
import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import type * as JamSessionSongsModule from '@/lib/jam/jam-session-songs'
import type { JamSong } from '@/lib/jam/jam-song'
import type * as ViewportModule from '@/lib/use-viewport'
import type * as JamStoreModule from '@/stores/jam-store'
import type { MelodyData } from '@/types'

const exampleSong = vi.fn<(m: DemoSongManifest) => Promise<JamSong | null>>()
const selectJamSong = vi.fn<(song: JamSong) => boolean>(() => true)
const selectJamExercise = vi.fn()
/**
 * The two things a page can be asked about its screen, kept apart because
 * they ARE apart: `phone` is the width the sidebar becomes a drawer at, and
 * `touch` is a finger instead of a mouse. A tablet is the second without
 * the first.
 */
const viewport = vi.hoisted(() => ({ phone: false, touch: false }))

const EXAMPLES: DemoSongManifest[] = ['Goodbye to Spring', 'Josephine'].map(
  (title, i) => ({
    slug: i === 0 ? 'karaoke-night' : 'josephine',
    title,
    artist: 'Josh Woodward',
    attribution: { text: '', url: '', license: '', licenseUrl: '' },
    stems: { instrumental: `https://stems.example/${i}/instrumental.m4a` },
    durationSec: 240,
  }),
)

vi.mock('@/features/karaoke-night/demo-song', async (original) => ({
  ...(await original<typeof DemoSongModule>()),
  loadDemoSongs: async () => EXAMPLES,
}))
vi.mock('@/lib/use-viewport', async (original) => ({
  ...(await original<typeof ViewportModule>()),
  isNarrow: () => viewport.phone,
  // True on a phone as well: a narrow screen is "mobile" whatever points at it.
  isMobile: () => viewport.phone || viewport.touch,
}))
vi.mock('@/features/challenges/weekly-service', () => ({
  getActiveWeekly: async () => null,
}))
vi.mock('@/lib/jam/jam-session-songs', async (original) => ({
  ...(await original<typeof JamSessionSongsModule>()),
  exampleSong: (m: DemoSongManifest) => exampleSong(m),
}))
vi.mock('@/stores/jam-store', async (original) => ({
  ...(await original<typeof JamStoreModule>()),
  selectJamSong: (song: JamSong) => selectJamSong(song),
  selectJamExercise: (melody: MelodyData) => selectJamExercise(melody),
}))

const { JamPickerList } = await import('@/components/jam/JamPickerList')
const { default: JamRoomPanel } =
  await import('@/features/sidebar/panels/JamRoomPanel')
const { setJamIsHost, setJamSong, setJamState } =
  await import('@/stores/jam-store')
const { setSidebarOpen, sidebarOpen } = await import('@/stores/ui-store')

const song = (id: string, title = 'Josephine'): JamSong => ({
  id,
  title,
  stems: { instrumental: 'https://stems.example/i.m4a' },
  lines: [],
  notes: [],
  durationSec: 240,
  origin: 'url',
})

beforeEach(async () => {
  localStorage.clear()
  viewport.phone = false
  viewport.touch = false
  setSidebarOpen(false)
  setJamState('idle')
  setJamSong(null)
  setJamIsHost(true)
  exampleSong.mockReset()
  selectJamSong.mockReset().mockReturnValue(true)
  selectJamExercise.mockReset()
  setJamState('active')
})

const josephine = () => screen.findByRole('button', { name: /Josephine/ })

describe('in the sidebar', () => {
  it('opens on the songs and folds the long lists away', async () => {
    render(() => <JamPickerList variant="rail" />)
    await josephine()
    expect(
      screen.getByRole('button', { name: /Example songs/ }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Exercises/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByRole('button', { name: /Long Note/ })).toBeNull()
  })

  it('unfolds a group and remembers it', async () => {
    const first = render(() => <JamPickerList variant="rail" />)
    await josephine()
    fireEvent.click(screen.getByRole('button', { name: /Exercises/ }))
    expect(screen.getByRole('button', { name: /Long Note/ })).toBeTruthy()
    first.unmount()

    render(() => <JamPickerList variant="rail" />)
    await josephine()
    expect(screen.getByRole('button', { name: /Exercises/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('says how many are in a group without opening it', async () => {
    render(() => <JamPickerList variant="rail" />)
    await josephine()
    const header = screen.getByRole('button', { name: /Example songs/ })
    expect(within(header).getByText('2')).toBeTruthy()
  })

  it('gives the guide tour a hook to unfold a group with', async () => {
    render(() => <JamPickerList variant="rail" />)
    await josephine()
    expect(screen.getByRole('button', { name: /Exercises/ })).toHaveAttribute(
      'data-collapsible',
      'sidebar-jam-picker-exercises-open',
    )
  })

  it('marks the row the room is running', async () => {
    setJamSong(song('karaoke-night-demo:josephine'))
    render(() => <JamPickerList variant="rail" />)
    expect(await josephine()).toHaveAttribute('aria-current', 'true')
    expect(
      screen.getByRole('button', { name: /Goodbye to Spring/ }),
    ).not.toHaveAttribute('aria-current')
  })
})

describe('in the popup', () => {
  it('lists every group open, with nothing to fold', async () => {
    render(() => <JamPickerList variant="popup" />)
    await josephine()
    expect(screen.getByRole('button', { name: /Long Note/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Exercises/ })).toBeNull()
  })
})

describe('picking from it', () => {
  it('tells its container once the room has the song', async () => {
    exampleSong.mockResolvedValue(song('karaoke-night-demo:josephine'))
    const onPicked = vi.fn()
    render(() => <JamPickerList variant="popup" onPicked={onPicked} />)
    fireEvent.click(await josephine())
    await waitFor(() => expect(onPicked).toHaveBeenCalledOnce())
  })

  it('stays open with the reason when the song would not load', async () => {
    exampleSong.mockResolvedValue(null)
    const onPicked = vi.fn()
    render(() => <JamPickerList variant="popup" onPicked={onPicked} />)
    fireEvent.click(await josephine())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Josephine could not be loaded',
    )
    expect(onPicked).not.toHaveBeenCalled()
  })

  it('shows the same failure in every place the list is open', async () => {
    // One store: the host is not left guessing in whichever list they are
    // not looking at.
    exampleSong.mockResolvedValue(null)
    render(() => (
      <>
        <JamPickerList variant="popup" />
        <JamPickerList variant="rail" />
      </>
    ))
    fireEvent.click(
      (await screen.findAllByRole('button', { name: /Josephine/ }))[0]!,
    )
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
  })
})

describe('the room panel in the sidebar', () => {
  it('gives the host the song list', async () => {
    render(() => <JamRoomPanel />)
    expect(await josephine()).toBeTruthy()
  })

  it('tells a guest what is loaded and who picks, instead of a list they cannot use', async () => {
    setJamIsHost(false)
    setJamSong(song('karaoke-night-demo:josephine', 'Josephine'))
    render(() => <JamRoomPanel />)
    expect(
      await screen.findByText(/The host picks what the room sings/),
    ).toBeTruthy()
    expect(screen.getByText('Josephine')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /Goodbye to Spring/ }),
    ).toBeNull()
  })

  it('shows nothing until a room is live', () => {
    setJamState('idle')
    const view = render(() => <JamRoomPanel />)
    expect(view.container).toBeEmptyDOMElement()
  })

  // On a phone the rail is a drawer that slides off-screen rather than
  // leaving the page. A closed one that kept its rows put a second, unseen
  // set of song buttons in the tab order -- and in front of the sheet's, for
  // anything that finds a song by its name. A browser spec caught it.
  it('keeps the list out of a phone drawer nobody has opened', async () => {
    viewport.phone = true
    render(() => <JamRoomPanel />)
    expect(screen.getByText('Songs and drills')).toBeTruthy()
    // Long enough for the examples to have loaded, had the list been there.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByRole('button', { name: /Josephine/ })).toBeNull()

    setSidebarOpen(true)
    expect(await josephine()).toBeTruthy()
  })

  // Owner report (2026-09-20, tablet): the songs were in the popup and the
  // sidebar had none. The list asked "is this a touch device" when it meant
  // "is the sidebar a drawer", and a tablet is a touch device whose sidebar
  // is on the page at full width and never opens as a drawer at all.
  it('gives a tablet its list: a touch screen is not a drawer', async () => {
    viewport.touch = true
    render(() => <JamRoomPanel />)
    expect(sidebarOpen()).toBe(false)
    expect(await josephine()).toBeTruthy()
  })

  it('leaves a tablet sidebar alone after a pick, like a desk', async () => {
    viewport.touch = true
    setSidebarOpen(true)
    exampleSong.mockResolvedValue(song('karaoke-night-demo:josephine'))
    render(() => <JamRoomPanel />)
    fireEvent.click(await josephine())
    await waitFor(() => expect(selectJamSong).toHaveBeenCalled())
    expect(sidebarOpen()).toBe(true)
  })

  it('folds the phone drawer away once a song is picked', async () => {
    viewport.phone = true
    setSidebarOpen(true)
    exampleSong.mockResolvedValue(song('karaoke-night-demo:josephine'))
    render(() => <JamRoomPanel />)
    fireEvent.click(await josephine())
    await waitFor(() => expect(sidebarOpen()).toBe(false))
  })

  it('leaves a desk sidebar open after a pick, which is the point of it', async () => {
    setSidebarOpen(true)
    exampleSong.mockResolvedValue(song('karaoke-night-demo:josephine'))
    render(() => <JamRoomPanel />)
    fireEvent.click(await josephine())
    await waitFor(() => expect(selectJamSong).toHaveBeenCalled())
    expect(sidebarOpen()).toBe(true)
  })
})
