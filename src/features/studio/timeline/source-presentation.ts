// Studio source presentation — provenance colors never replace musical roles or source names.
import type { SourceKind, StudioAsset } from '@/lib/studio/model/types'

const labels: Record<SourceKind, string> = {
  karaoke: 'Karaoke',
  freeform: 'Hear Yourself',
  'guitar-night': 'Guitar',
  'piano-night': 'Piano',
  'drum-night': 'Drums',
  file: 'Audio file',
  glass: 'Glass',
  exercise: 'Exercise',
  legend: 'Weekly Legend',
  guided: 'Guided check',
}
const tints: Partial<Record<SourceKind, string>> = {
  karaoke: '#c2566b',
  freeform: '#8c5ba8',
  'guitar-night': '#b07a1e',
  'piano-night': '#2f8c86',
  'drum-night': '#6e8b3d',
  file: '#8c7b6b',
}

export function studioSourcePresentation(asset?: StudioAsset): {
  label: string
  color: string
} {
  if (!asset) return { label: 'Audio', color: '#8c7b6b' }
  const kind = asset.provenance.kind
  let label = labels[kind]
  if (kind === 'karaoke') label += ', voice only'
  if (kind === 'piano-night')
    label += asset.channels === 1 ? ' replay, mono' : ' replay'
  if (
    kind === 'guitar-night' &&
    asset.provenance.sourceId?.startsWith('guitar-take:') === true
  )
    label += ', dry input'
  return { label, color: tints[kind] ?? '#8c7b6b' }
}
