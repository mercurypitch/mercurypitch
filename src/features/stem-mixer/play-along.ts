// Play-along presets — turn stored stems into role-based backing mixes.

import type { StemSplitPart } from '@/lib/uvr-stem-split'
import { PART_STEM_DISPLAY } from '@/lib/uvr-stem-split'

export type PlayAlongStemKey = 'vocal' | 'instrumental' | StemSplitPart

export type PlayAlongRole = 'sing' | 'play' | StemSplitPart

export interface PlayAlongPreset {
  id: PlayAlongRole
  label: string
  description: string
  selectedStemKeys: readonly PlayAlongStemKey[]
  mutedStemKeys: readonly PlayAlongStemKey[]
}

const PART_KEYS = Object.keys(PART_STEM_DISPLAY) as StemSplitPart[]

// "Other" completes a reconstructed backing track, but it is not a useful
// performer role: it can contain any residual instruments and bleed.
const PERFORMER_PART_KEYS: readonly StemSplitPart[] = [
  'drums',
  'bass',
  'guitar',
  'piano',
]

export function isPlayAlongStemKey(key: string): key is PlayAlongStemKey {
  return key === 'vocal' || key === 'instrumental' || key in PART_STEM_DISPLAY
}

/**
 * Build truthful play-along choices from the stems available on this device.
 *
 * A part-stem preset deliberately excludes the original Instrumental stem:
 * that mix already contains every derived part, so playing it alongside the
 * drums/bass/guitar/etc. would double the backing and leak the muted role.
 */
export function playAlongPresets(
  availableStemKeys: readonly string[],
): PlayAlongPreset[] {
  const available = new Set(availableStemKeys.filter(isPlayAlongStemKey))
  const parts = PART_KEYS.filter((key) => available.has(key))
  const performerParts = PERFORMER_PART_KEYS.filter((key) => available.has(key))
  const presets: PlayAlongPreset[] = []

  if (available.has('vocal')) {
    const backing: PlayAlongStemKey[] = available.has('instrumental')
      ? ['instrumental']
      : parts
    if (backing.length > 0) {
      presets.push({
        id: 'sing',
        label: 'I sing',
        description: 'Mute the guide vocal and keep the backing track.',
        selectedStemKeys: ['vocal', ...backing],
        mutedStemKeys: ['vocal'],
      })
    }
  }

  if (
    available.has('vocal') &&
    available.has('instrumental') &&
    performerParts.length === 0
  ) {
    presets.push({
      id: 'play',
      label: 'I play',
      description: 'Mute the backing track and keep the vocal guide.',
      selectedStemKeys: ['vocal', 'instrumental'],
      mutedStemKeys: ['instrumental'],
    })
  }

  for (const target of performerParts) {
    const selected: PlayAlongStemKey[] = [
      ...(available.has('vocal') ? (['vocal'] as const) : []),
      ...parts,
    ]
    if (selected.some((key) => key !== target)) {
      const name = PART_STEM_DISPLAY[target].label.toLocaleLowerCase()
      presets.push({
        id: target,
        label: `I play ${name}`,
        description: `Mute ${name} while the other isolated stems play.`,
        selectedStemKeys: selected,
        mutedStemKeys: [target],
      })
    }
  }

  return presets
}
