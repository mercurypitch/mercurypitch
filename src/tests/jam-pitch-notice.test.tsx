// ── What the lanes say when there is nothing to aim at ───────────────
//
// A song with no stored analysis gave the room an empty note list, and
// the lanes drew nothing and said nothing. "This song has no pitch
// guide", "one is being worked out" and "working one out failed" were
// the same blank rectangle, which reads as a broken app.
//
// Three states, one strip, and the accessibility contract that goes with
// each: a progressbar carries its value, a failure is a live status with
// a way out, and a guest is told who can fix it rather than handed a
// button that would do nothing for them.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JamPeerLanes } from '@/components/jam/JamPeerLanes'
import { GUEST_NO_GUIDE_REASON, GUEST_WAITING_REASON, } from '@/lib/jam/jam-pitch-provision'
import type { JamSong } from '@/lib/jam/jam-song'
import type { JamSongNote } from '@/lib/jam/types'
import type { VocalAnalysis } from '@/lib/pitch-pipeline'
import { abandonJamSongPitch, provideJamSongPitch, setJamPitchProvisionSeams, } from '@/stores/jam-pitch-provision-store'
import { setJamIsHost, setJamPeers, setJamPitchHistory, setJamSong, setJamSongParts, } from '@/stores/jam-store'

vi.mock('@/stores/notifications-store', () => ({
  showNotification: vi.fn(),
}))

const ME = 'me-peer'
const NOTE: JamSongNote = { midi: 60, startSec: 0, endSec: 4 }

function song(over: Partial<JamSong> = {}): JamSong {
  return {
    id: 'session:abc123',
    title: 'A Song',
    stems: { instrumental: 'blob:inst', vocal: 'blob:vox' },
    lines: [],
    notes: [],
    durationSec: 120,
    origin: 'local',
    ...over,
  }
}

const SAMPLES = { samples: new Float32Array(16), sampleRate: 16000 }

function emptyAnalysis(notes: number[]): VocalAnalysis {
  return {
    algo: 'yin',
    rawDetections: [],
    contour: [],
    mergedNotes: [],
    segmentedNotes: notes.map((midi, i) => ({
      midi,
      noteName: 'C4',
      startSec: i,
      endSec: i + 0.5,
    })),
  }
}

/** Mount the lane area. The canvases are inert -- this is about the DOM. */
function mountLanes(): void {
  render(() => (
    <JamPeerLanes myPeerId={() => ME} notes={() => []} positionSec={() => 1} />
  ))
}

describe('the lane area with no pitch guide', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    abandonJamSongPitch()
    setJamPitchProvisionSeams(null)
    setJamPeers([])
    setJamPitchHistory({})
    setJamSongParts({})
    setJamIsHost(true)
    setJamSong(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    abandonJamSongPitch()
    setJamPitchProvisionSeams(null)
    setJamSong(null)
    setJamIsHost(false)
  })

  it('raises no notice once the song has a line to aim at', () => {
    setJamSong(song({ notes: [NOTE], notesFrom: 'saved' }))
    mountLanes()
    expect(screen.queryByTestId('jam-pitch-notice')).toBeNull()
  })

  it('reports how far the analysis has got, as a progressbar', async () => {
    let report: ((pct: number) => void) | undefined
    setJamPitchProvisionSeams({
      loadVocalSamples: async () => SAMPLES,
      analyze: async (_s, _r, _o, run) => {
        report = run?.onProgress
        return new Promise<VocalAnalysis>(() => undefined)
      },
      save: async () => undefined,
    })
    const loaded = song()
    setJamSong(loaded)
    mountLanes()

    provideJamSongPitch({
      song: loaded,
      isHost: true,
      onNotes: () => undefined,
    })
    const bar = await screen.findByRole('progressbar')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
    expect(bar.getAttribute('aria-valuenow')).toBe('0')
    // Named, because a bar with no name is a rectangle a screen reader
    // reads as "0 percent" of nothing.
    expect(bar.getAttribute('aria-label')).toBe('Working out the pitch guide')

    await waitFor(() => expect(report).toBeDefined())
    report?.(64)
    await waitFor(() =>
      expect(
        screen.getByRole('progressbar').getAttribute('aria-valuenow'),
      ).toBe('64'),
    )
    expect(screen.getByTestId('jam-pitch-notice').textContent).toContain('64%')
  })

  it('offers the host a way to try again when it fails', async () => {
    let attempts = 0
    setJamPitchProvisionSeams({
      loadVocalSamples: async () => SAMPLES,
      analyze: async () => {
        attempts++
        throw new Error('decode exploded')
      },
      save: async () => undefined,
    })
    const errors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const loaded = song()
    setJamSong(loaded)
    mountLanes()

    provideJamSongPitch({
      song: loaded,
      isHost: true,
      onNotes: () => undefined,
    })

    await waitFor(() =>
      expect(
        screen.getByTestId('jam-pitch-notice').getAttribute('data-state'),
      ).toBe('unavailable'),
    )
    const notice = screen.getByTestId('jam-pitch-notice')
    // A failure a singer might sit in front of has to announce itself.
    expect(notice.getAttribute('role')).toBe('status')
    expect(notice.getAttribute('aria-live')).toBe('polite')
    expect(notice.textContent).toContain('Try again')

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(attempts).toBe(2))
    errors.mockRestore()
  })

  it('tells a guest who can make one, and hands them no button', async () => {
    setJamIsHost(false)
    setJamSong(song())
    mountLanes()

    const notice = await screen.findByTestId('jam-pitch-notice')
    expect(notice.textContent).toContain(GUEST_WAITING_REASON)
    // Retrying would analyse a stem a guest may not even hold, and the
    // result could not be sent to the room anyway.
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('tells a guest plainly when the host has said there will be none', async () => {
    // "The host is working one out" is a promise. Left up for a song nothing
    // can be made for, it is a promise nobody keeps.
    setJamIsHost(false)
    setJamSong(song({ pitchGuide: 'unavailable' }))
    mountLanes()

    const notice = await screen.findByTestId('jam-pitch-notice')
    expect(notice.textContent).toContain(GUEST_NO_GUIDE_REASON)
    expect(notice.textContent).not.toContain(GUEST_WAITING_REASON)
  })

  it('stops raising a notice the moment the line arrives', async () => {
    setJamPitchProvisionSeams({
      loadVocalSamples: async () => SAMPLES,
      analyze: async () => emptyAnalysis([60]),
      save: async () => undefined,
    })
    const loaded = song()
    setJamSong(loaded)
    mountLanes()

    provideJamSongPitch({
      song: loaded,
      isHost: true,
      onNotes: (_id, notes) => setJamSong({ ...loaded, notes }),
    })
    await waitFor(() =>
      expect(screen.queryByTestId('jam-pitch-notice')).toBeNull(),
    )
  })
})

// ── ...and what they say once there is something ─────────────────────
//
// The first version was silent here, so a line cleaned up in this room a
// minute ago, one corrected by hand last week and a room where nothing
// had happened at all looked exactly alike -- and "was it cleaned up?"
// had no answer on the screen.

describe('the caption over a pitch guide', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    abandonJamSongPitch()
    setJamPitchProvisionSeams(null)
    setJamPeers([])
    setJamPitchHistory({})
    setJamSongParts({})
    setJamIsHost(true)
    setJamSong(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    abandonJamSongPitch()
    setJamPitchProvisionSeams(null)
    setJamSong(null)
    setJamIsHost(false)
  })

  const caption = (): string | null =>
    screen.queryByTestId('jam-pitch-credit')?.textContent ?? null

  it('says a stored guide is the one saved on this device', () => {
    setJamSong(song({ notes: [NOTE], notesFrom: 'saved' }))
    mountLanes()
    expect(caption()).toBe('Pitch guide: saved on this device')
  })

  it("says so when it is the singer's own correction", () => {
    setJamSong(song({ notes: [NOTE], notesFrom: 'edited' }))
    mountLanes()
    expect(caption()).toBe('Pitch guide: the one you corrected in Karaoke')
  })

  it('credits the room for a line worked out here', async () => {
    setJamPitchProvisionSeams({
      loadVocalSamples: async () => SAMPLES,
      analyze: async () => emptyAnalysis([60]),
      save: async () => undefined,
    })
    const loaded = song()
    setJamSong(loaded)
    mountLanes()

    provideJamSongPitch({
      song: loaded,
      isHost: true,
      onNotes: (_id, notes) =>
        setJamSong({ ...loaded, notes, notesFrom: 'room' }),
    })
    await waitFor(() =>
      expect(caption()).toBe('Pitch guide: worked out in this room'),
    )
  })

  it('tells a guest whose line it is', () => {
    setJamIsHost(false)
    // Over the wire a song carries notes and no word about where they came
    // from: provenance is a fact about the host's device, not the room's.
    setJamSong(song({ notes: [NOTE], origin: 'url' }))
    mountLanes()
    expect(caption()).toBe('Pitch guide: from the host')
  })

  it('is a caption, not an announcement', () => {
    setJamSong(song({ notes: [NOTE], notesFrom: 'saved' }))
    mountLanes()
    const line = screen.getByTestId('jam-pitch-credit')
    // Read aloud on every song load, it would be the room talking over
    // the singer.
    expect(line.getAttribute('role')).toBeNull()
    expect(line.getAttribute('aria-live')).toBeNull()
  })

  it('keeps quiet while a guide is still being worked out', async () => {
    setJamPitchProvisionSeams({
      loadVocalSamples: async () => SAMPLES,
      analyze: async () => new Promise<VocalAnalysis>(() => undefined),
      save: async () => undefined,
    })
    const loaded = song({ notes: [NOTE], notesFrom: 'raw' })
    setJamSong(loaded)
    mountLanes()

    provideJamSongPitch({
      song: loaded,
      isHost: true,
      onNotes: () => undefined,
    })
    await screen.findByRole('progressbar')
    expect(caption()).toBeNull()
  })

  it('has nothing to say when there is no guide', () => {
    setJamSong(song())
    mountLanes()
    expect(caption()).toBeNull()
  })
})
