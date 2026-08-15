// ============================================================
// StemMixer — who lets go of the stem blob URLs
// ============================================================
//
// The defect: UvrPanel minted an object URL per separated stem, handed them to
// the mixer with the comment "The new StemMixer now owns these blob URLs", and
// the mixer never revoked any of them. "Add stem" minted more. A blob URL pins
// its data for the life of the DOCUMENT, and a four-minute stem WAV is 20-60
// MB, so opening a few mixes left hundreds of megabytes alive for the rest of
// the tab's life.
//
// `URL.revokeObjectURL` is stubbed and counted. It has to be: the project's own
// bug notes record this whole class of leak as *untestable* because setup.ts
// stubs createObjectURL and leaves revokeObjectURL undefined, so the
// mint/revoke balance could not be observed. Making it observable is half the
// fix.
//
// The mixer is rendered whole rather than driven through a seam, because the
// bug lived in the seam: every individual piece behaved, and what was missing
// was anybody calling the release.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// jsdom has no matchMedia, and the mixer's canvas controller watches DPR.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia

const uvr = vi.hoisted(() => ({
  listStemTypes: vi.fn(async (): Promise<string[]> => []),
  getStemBlobUrl: vi.fn(async (): Promise<string | null> => null),
}))

vi.mock('@/db/services/uvr-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listStemTypes: uvr.listStemTypes,
  getStemBlobUrl: uvr.getStemBlobUrl,
}))

import { StemMixer } from '@/components/StemMixer'

const REMOTE = 'https://cdn.example/instrumental.wav'

/** A Response the progress loader can read in one atomic go (body === null). */
function wavResponse(): unknown {
  return {
    ok: true,
    status: 200,
    body: null,
    headers: new Headers(),
    arrayBuffer: async () => new ArrayBuffer(64),
  }
}

/** The setup mock has no decodeAudioData; the mixer's load path needs one. */
function stubDecoding(): void {
  ;(
    AudioContext.prototype as unknown as Record<string, unknown>
  ).decodeAudioData = async () =>
    ({
      duration: 12,
      length: 512,
      numberOfChannels: 2,
      sampleRate: 44100,
      getChannelData: () => new Float32Array(512),
    }) as unknown as AudioBuffer
}

let revoked: string[]

beforeEach(() => {
  revoked = []
  uvr.listStemTypes.mockResolvedValue([])
  uvr.getStemBlobUrl.mockResolvedValue(null)
  vi.stubGlobal('URL', {
    ...URL,
    revokeObjectURL: (url: string) => revoked.push(url),
    createObjectURL: URL.createObjectURL,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function mountMixer(
  extraStems: Array<{
    key: string
    label: string
    color: string
    url: string
  }>,
): { unmount: () => void } {
  return render(() => (
    <StemMixer
      stems={{ vocal: 'blob:vocal-from-store', instrumental: REMOTE }}
      extraStems={extraStems}
      sessionId="session-1"
      songTitle="Consent"
    />
  ))
}

describe('the URLs the mixer was handed', () => {
  it('releases them when it unmounts', () => {
    // THE REGRESSION. Pre-fix `revoked` stayed empty here, and the blobs
    // outlived the component that was told it owned them.
    const { unmount } = mountMixer([
      { key: 'drums', label: 'Drums', color: '#f00', url: 'blob:drums' },
      { key: 'bass', label: 'Bass', color: '#0f0', url: 'blob:bass' },
    ])

    expect(revoked).toEqual([])
    unmount()

    expect(revoked.sort()).toEqual(['blob:bass', 'blob:drums'])
  })

  it('leaves alone the ones it does not own', () => {
    // props.stems come from the session store, which is still using them —
    // the panel behind the mixer renders from the same urls. And a remote
    // stem has nothing to revoke.
    const { unmount } = mountMixer([
      { key: 'drums', label: 'Drums', color: '#f00', url: REMOTE },
    ])

    unmount()

    expect(revoked).not.toContain('blob:vocal-from-store')
    expect(revoked).not.toContain(REMOTE)
    expect(revoked).toEqual([])
  })

  it('releases each one exactly once', () => {
    const { unmount } = mountMixer([
      { key: 'drums', label: 'Drums', color: '#f00', url: 'blob:same' },
      { key: 'bass', label: 'Bass', color: '#0f0', url: 'blob:same' },
    ])

    unmount()

    // Two lanes, one blob. Revoking twice is a silent no-op in browsers, so a
    // double-release would sit here undetected until it was not.
    expect(revoked).toEqual(['blob:same'])
  })
})

describe('the URLs "Add stem" mints', () => {
  beforeEach(() => {
    uvr.listStemTypes.mockResolvedValue(['drums'])
    stubDecoding()
    // The mount-time load of vocal + instrumental has to succeed, or the mixer
    // shows its error state and the pills never render.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => wavResponse()),
    )
  })

  async function clickAddDrums(): Promise<void> {
    const pill = await screen.findByTitle('Add the Drums stem to the mix')
    fireEvent.click(pill)
  }

  it('holds a successful add until unmount, not until it decodes', async () => {
    // Decoding does not spend the url: the track keeps it and re-fetches on
    // seek and on download. Revoking after decode would leave both dead.
    uvr.getStemBlobUrl.mockResolvedValue('blob:added-drums')

    const { unmount } = mountMixer([])
    await clickAddDrums()
    await waitFor(() =>
      expect(uvr.getStemBlobUrl).toHaveBeenCalledWith('session-1', 'drums'),
    )
    await waitFor(() =>
      expect(screen.queryByTitle('Add the Drums stem to the mix')).toBeNull(),
    )
    expect(revoked).toEqual([])

    unmount()
    expect(revoked).toEqual(['blob:added-drums'])
  })

  it('lets go immediately when the add fails', async () => {
    // Each retry mints another. Carrying every failed attempt until unmount
    // is the same leak in slower motion.
    uvr.getStemBlobUrl.mockResolvedValue('blob:doomed')

    const { unmount } = mountMixer([])
    // Let the mount-time load finish first, then fail only the add's fetch.
    await screen.findByTitle('Add the Drums stem to the mix')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 })),
    )
    await clickAddDrums()

    await waitFor(() => expect(revoked).toEqual(['blob:doomed']))

    unmount()
    // Not a second time on the way out.
    expect(revoked).toEqual(['blob:doomed'])
  })

  it('has nothing to release when the stem is gone from the device', async () => {
    uvr.getStemBlobUrl.mockResolvedValue(null)

    const { unmount } = mountMixer([])
    await clickAddDrums()
    await waitFor(() => expect(uvr.getStemBlobUrl).toHaveBeenCalled())

    unmount()
    expect(revoked).toEqual([])
  })
})
