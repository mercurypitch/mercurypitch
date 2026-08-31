// ============================================================
// StemMixer Stem Controls Controller — Volume, Mute, Solo & Addable Stems
// ============================================================

import type { Accessor, Setter } from 'solid-js'
import { batch, createEffect, createResource, createSignal } from 'solid-js'
import { getStemBlobUrl, listStemTypes } from '@/db/services/uvr-service'
import type { StemSplitPart } from '@/lib/uvr-stem-split'
import { PART_STEM_DISPLAY } from '@/lib/uvr-stem-split'
import { sliderToGain } from '@/lib/volume-curve'
import { setStemVolume, stemMixHasSolo, stemTrackOutputLevel, toggleStemMute, toggleStemSolo, } from './stem-mix-state'
import type { StemTrack } from './useStemMixerAudioController'

export interface UseStemMixerStemControlsDeps {
  tracks: Accessor<readonly StemTrack[]>
  setVocal: Setter<StemTrack>
  setInstrumental: Setter<StemTrack>
  setMidi: Setter<StemTrack>
  setExtras: Setter<StemTrack[]>
  getSessionId: () => string
  activeStemSplits: Accessor<unknown>
  addExtraStem: (stem: {
    label: string
    color: string
    url: string
  }) => Promise<boolean>
  showNotification: (
    message: string,
    type?: 'info' | 'warning' | 'error',
  ) => void
}

export interface UseStemMixerStemControlsReturn {
  setTrackVolume: (label: string, volume: number) => void
  toggleMute: (label: string) => void
  toggleSolo: (label: string) => void
  commitStemMix: (nextTracks: readonly StemTrack[]) => void
  addingStem: Accessor<string | null>
  addableStems: () => Array<{ key: string; label: string; color: string }>
  handleAddStem: (key: string) => Promise<void>
}

export function useStemMixerStemControls(
  deps: UseStemMixerStemControlsDeps,
): UseStemMixerStemControlsReturn {
  const setTrackByLabel = (
    label: string,
    update: (prev: StemTrack) => StemTrack,
  ) => {
    if (label === 'Vocal') deps.setVocal(update)
    else if (label === 'Instrumental') deps.setInstrumental(update)
    else if (label === 'MIDI') deps.setMidi(update)
    else {
      deps.setExtras((list) =>
        list.map((t) => (t.label === label ? update(t) : t)),
      )
    }
  }

  const commitStemMix = (nextTracks: readonly StemTrack[]) => {
    const hasSolo = stemMixHasSolo(nextTracks)
    batch(() => {
      for (const next of nextTracks) {
        if (next.gainNode) {
          next.gainNode.gain.value = sliderToGain(
            stemTrackOutputLevel(next, hasSolo),
          )
        }
        setTrackByLabel(next.label, (prev) => ({
          ...prev,
          muted: next.muted,
          soloed: next.soloed,
          volume: next.volume,
        }))
      }
    })
  }

  const setTrackVolume = (label: string, volume: number) => {
    commitStemMix(setStemVolume(deps.tracks(), label, volume))
  }

  const toggleMute = (label: string) => {
    commitStemMix(toggleStemMute(deps.tracks(), label))
  }

  const toggleSolo = (label: string) => {
    commitStemMix(toggleStemSolo(deps.tracks(), label))
  }

  const [addingStem, setAddingStem] = createSignal<string | null>(null)

  const [deviceStems, { refetch: refetchDeviceStems }] = createResource(
    deps.getSessionId,
    listStemTypes,
  )

  createEffect(() => {
    deps.activeStemSplits()
    void refetchDeviceStems()
  })

  const addableStems = (): Array<{
    key: string
    label: string
    color: string
  }> => {
    const inMix = new Set(deps.tracks().map((t) => t.label))
    return (deviceStems() ?? [])
      .filter((k): k is StemSplitPart => k in PART_STEM_DISPLAY)
      .filter((k) => !inMix.has(PART_STEM_DISPLAY[k].label))
      .map((k) => ({
        key: k,
        label: PART_STEM_DISPLAY[k].label,
        color: PART_STEM_DISPLAY[k].color,
      }))
  }

  const handleAddStem = async (key: string): Promise<void> => {
    if (addingStem() !== null) return
    setAddingStem(key)
    try {
      const part = key as StemSplitPart
      const url = await getStemBlobUrl(deps.getSessionId(), part)
      if (url === null) {
        deps.showNotification(
          "That stem isn't on this device anymore — run the full-band split again to bring it back.",
          'warning',
        )
        return
      }
      const ok = await deps.addExtraStem({
        label: PART_STEM_DISPLAY[part].label,
        color: PART_STEM_DISPLAY[part].color,
        url,
      })
      if (!ok) {
        deps.showNotification("Couldn't load that stem — try again.", 'error')
      }
    } finally {
      setAddingStem(null)
    }
  }

  return {
    setTrackVolume,
    toggleMute,
    toggleSolo,
    commitStemMix,
    addingStem,
    addableStems,
    handleAddStem,
  }
}
