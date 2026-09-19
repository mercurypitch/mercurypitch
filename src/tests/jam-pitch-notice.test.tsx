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
import { GUEST_WAITING_REASON } from '@/lib/jam/jam-pitch-provision'
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

  it('says nothing at all once the song has a line to aim at', () => {
    setJamSong(song({ notes: [NOTE] }))
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

  it('stops saying anything the moment the line arrives', async () => {
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
