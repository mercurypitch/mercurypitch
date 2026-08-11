// ============================================================
// Piano Night source — route-neutral score plus truthful library metadata
// ============================================================
//
// The performance runtime consumes a projected stage rather than assuming
// every selectable song originated as a PianoProject. Canonical projects keep
// their lossless authority attached, while compositions can supply the same
// stage vocabulary without fabricating MIDI provenance.

import type { PianoProjectStage } from '@/features/piano/runtime/piano-project-stage'
import { pianoProjectToStage } from '@/features/piano/runtime/piano-project-stage'
import type { PianoProject } from '@/features/piano-project/piano-project'
import { PIANO_NIGHT_DEMO_PROJECT } from './piano-night-demo-project'

export type PianoNightSourceProvenance =
  | 'included'
  | 'composition'
  | 'midi'
  | 'legacy-midi'

export interface PianoNightSource {
  /** Stable route-local identity; provenance is namespaced into every id. */
  readonly id: string
  readonly provenance: PianoNightSourceProvenance
  readonly provenanceLabel: string
  readonly practiceTrackLabel: string
  readonly additionalTrackCount: number
  readonly keyLabel: string
  readonly hasAuthoredCoach: boolean
  /** Tempo events after the initial transport tempo. */
  readonly tempoMapChangeCount: number
  readonly stage: PianoProjectStage
  /** Present only when a canonical project remains the source authority. */
  readonly project?: PianoProject
}

export interface PianoNightProjectSourceOptions {
  readonly hasAuthoredCoach?: boolean
}

const MAJOR_KEYS = [
  'C-flat major',
  'G-flat major',
  'D-flat major',
  'A-flat major',
  'E-flat major',
  'B-flat major',
  'F major',
  'C major',
  'G major',
  'D major',
  'A major',
  'E major',
  'B major',
  'F-sharp major',
  'C-sharp major',
] as const

const MINOR_KEYS = [
  'A-flat minor',
  'E-flat minor',
  'B-flat minor',
  'F minor',
  'C minor',
  'G minor',
  'D minor',
  'A minor',
  'E minor',
  'B minor',
  'F-sharp minor',
  'C-sharp minor',
  'G-sharp minor',
  'D-sharp minor',
  'A-sharp minor',
] as const

function projectProvenance(
  project: PianoProject,
): Exclude<PianoNightSourceProvenance, 'composition'> {
  if (project.source.kind === 'bundled') return 'included'
  return project.source.kind
}

function provenanceLabel(provenance: PianoNightSourceProvenance): string {
  if (provenance === 'included') return 'Included study'
  if (provenance === 'composition') return 'MercuryPitch composition'
  if (provenance === 'midi') return 'Imported MIDI'
  return 'Migrated MIDI'
}

function projectKeyLabel(project: PianoProject): string {
  const signature = project.keySignatures[0]
  if (signature === undefined) return 'Key not specified'
  const index = signature.sharpsFlats + 7
  return (
    (signature.mode === 1 ? MINOR_KEYS[index] : MAJOR_KEYS[index]) ??
    'Key not specified'
  )
}

function practiceTrackLabel(project: PianoProject): string {
  const track = project.tracks.find(
    (candidate) => candidate.id === project.scoreTrackId,
  )
  return track?.instrumentName ?? track?.name ?? 'Piano score'
}

/** Project canonical tick-native authority into the standalone source shape. */
export function pianoProjectToPianoNightSource(
  project: PianoProject,
  options: PianoNightProjectSourceOptions = {},
): PianoNightSource {
  const provenance = projectProvenance(project)
  const stage = pianoProjectToStage(project)
  return Object.freeze({
    id: `piano-night:${provenance}:${project.id}`,
    provenance,
    provenanceLabel: provenanceLabel(provenance),
    practiceTrackLabel: practiceTrackLabel(project),
    additionalTrackCount: project.backingTrackIds.length,
    keyLabel: projectKeyLabel(project),
    hasAuthoredCoach: options.hasAuthoredCoach ?? false,
    tempoMapChangeCount: Math.max(0, stage.tempoMap.points.length - 1),
    stage,
    project,
  })
}

export const PIANO_NIGHT_INCLUDED_SOURCE = pianoProjectToPianoNightSource(
  PIANO_NIGHT_DEMO_PROJECT,
  { hasAuthoredCoach: true },
)
