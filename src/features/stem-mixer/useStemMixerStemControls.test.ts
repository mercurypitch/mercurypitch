// ============================================================
// useStemMixerStemControls unit tests
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StemTrack } from './useStemMixerAudioController'
import { useStemMixerStemControls } from './useStemMixerStemControls'

const mockListStemTypes = vi.fn(async () => ['drums', 'bass', 'guitar'])
const mockGetStemBlobUrl = vi.fn(async (_sessionId: string, part: string) => {
  if (part === 'drums') return 'blob:drums-url'
  if (part === 'guitar') return 'blob:guitar-url'
  return null
})

vi.mock('@/db/services/uvr-service', () => ({
  listStemTypes: () => mockListStemTypes(),
  getStemBlobUrl: (sessionId: string, part: string) =>
    mockGetStemBlobUrl(sessionId, part),
}))

const createTrack = (label: string, volume = 0.8): StemTrack => ({
  label,
  url: `blob:${label}`,
  color: '#ffffff',
  buffer: null,
  gainNode: { gain: { value: 0.8 } } as unknown as GainNode,
  analyserNode: null,
  sourceNode: null,
  muted: false,
  soloed: false,
  volume,
})

describe('useStemMixerStemControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates volume, mute, and solo across named and extra tracks', () => {
    createRoot((dispose) => {
      const [vocal, setVocal] = createSignal(createTrack('Vocal'))
      const [instrumental, setInstrumental] = createSignal(
        createTrack('Instrumental'),
      )
      const [midi, setMidi] = createSignal(createTrack('MIDI'))
      const [extras, setExtras] = createSignal<StemTrack[]>([
        createTrack('Guitar'),
      ])

      const tracks = () => [vocal(), instrumental(), midi(), ...extras()]
      const showNotification = vi.fn()
      const addExtraStem = vi.fn(async () => true)

      const controls = useStemMixerStemControls({
        tracks,
        setVocal,
        setInstrumental,
        setMidi,
        setExtras,
        getSessionId: () => 'test-session',
        activeStemSplits: () => [],
        addExtraStem,
        showNotification,
      })

      // Set volume on Vocal
      controls.setTrackVolume('Vocal', 0.5)
      /* eslint-disable solid/reactivity */
      expect(vocal().volume).toBe(0.5)

      // Toggle Mute on Instrumental
      controls.toggleMute('Instrumental')
      expect(instrumental().muted).toBe(true)

      // Toggle Solo on Guitar (extra track)
      controls.toggleSolo('Guitar')
      expect(extras()[0].soloed).toBe(true)

      // Toggle Solo on MIDI
      controls.toggleSolo('MIDI')
      expect(midi().soloed).toBe(true)
      /* eslint-enable solid/reactivity */

      dispose()
    })
  })

  it('handles addable stems, stem addition error, and concurrent add guards', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [vocal, setVocal] = createSignal(createTrack('Vocal'))
        const [instrumental, setInstrumental] = createSignal(
          createTrack('Instrumental'),
        )
        const [midi, setMidi] = createSignal(createTrack('MIDI'))
        const [extras, setExtras] = createSignal<StemTrack[]>([
          createTrack('Drums'),
        ])

        const tracks = () => [vocal(), instrumental(), midi(), ...extras()]
        const showNotification = vi.fn()
        const addExtraStem = vi.fn(
          async ({ label }: { label: string }) => label !== 'Guitar',
        )

        const controls = useStemMixerStemControls({
          tracks,
          setVocal,
          setInstrumental,
          setMidi,
          setExtras,
          getSessionId: () => 'test-session',
          activeStemSplits: () => [],
          addExtraStem,
          showNotification,
        })

        // Wait a microtask for resource to resolve
        await new Promise((r) => setTimeout(r, 10))

        // Check addable stems (Drums is already in mix, so Bass and Guitar remain)
        const addable = controls.addableStems()
        expect(addable.some((s) => s.key === 'drums')).toBe(false)
        expect(addable.some((s) => s.key === 'bass')).toBe(true)

        // Add guitar (where addExtraStem returns false -> error notification)
        await controls.handleAddStem('guitar')
        expect(showNotification).toHaveBeenCalledWith(
          expect.stringContaining("Couldn't load that stem"),
          'error',
        )

        // Add bass (returns null url -> warning notification)
        await controls.handleAddStem('bass')
        expect(showNotification).toHaveBeenCalledWith(
          expect.stringContaining("isn't on this device anymore"),
          'warning',
        )

        dispose()
        resolve()
      })
    })
  })
})
