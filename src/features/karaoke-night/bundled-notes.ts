// ============================================================
// The notes a bundled example ships with, stored where the mixer looks
// ============================================================
//
// A phone cannot analyse a streamed vocal (audit K1): the offline analysis
// decodes the whole stem, and the native Karaoke room streams. So the example
// songs carry the notes the mixer's own analysis produced, generated once on
// a desktop (apps/mercurypitch/scripts/generate-karaoke-example-notes.mjs),
// and this stores them under the song's session id: `loadCachedAnalysis`
// finds them there exactly as it finds an analysis the mixer ran, and the
// note labels, the mic ribbon and the Options sheet's notes row follow.
//
// Never over a record that is already there. That is either this seed on an
// earlier launch, or the singer's own run of the analysis, or their edits to
// the notes (the edit layer lives in the same record), and the last two are
// theirs to keep.
//
// Loaded on demand by the native seed only; the web never reaches it.

import { fetchAssetRead } from '@irchiinnuss/mobile-runtime/asset-fetch'
import { loadPitchAnalysisFromDbStrict, savePitchAnalysisToDbStrict, } from '@/db/services/session-pitch-analysis-service'
import type { KeyRegion } from '@/lib/key-detection'
import type { MergedNote } from '@/lib/midi-generator'
import { pitchHistoryFromNotes } from '@/lib/pitch-pipeline/analyze-vocal'
import type { BundledExample } from './bundled-examples'
import { demoSessionId } from './demo-song'

/** What notes.json holds: the stored record, less what is derived. */
interface BundledNotesFile {
  version: 1
  mergedNotes: MergedNote[]
  segmentedNotes: MergedNote[]
  keyRegions: KeyRegion[]
}

function isNotesFile(value: unknown): value is BundledNotesFile {
  if (typeof value !== 'object' || value === null) return false
  const file = value as Partial<BundledNotesFile>
  return (
    file.version === 1 &&
    Array.isArray(file.mergedNotes) &&
    Array.isArray(file.segmentedNotes) &&
    Array.isArray(file.keyRegions)
  )
}

/**
 * Store `song`'s notes under its session id, unless it already has a record.
 * True when this wrote them. Throws on a failed read or write; the seed
 * catches, and a song whose notes did not land simply has none this launch.
 */
export async function seedBundledNotes(song: BundledExample): Promise<boolean> {
  const url = song.notes ?? ''
  if (url === '') return false
  const sessionId = demoSessionId(song.slug)
  if ((await loadPitchAnalysisFromDbStrict(sessionId)) !== null) return false

  const read = await fetchAssetRead(url)
  const parsed = JSON.parse(new TextDecoder().decode(read.bytes)) as unknown
  if (!isNotesFile(parsed)) throw new Error(`Not a notes file: ${url}`)

  // Looked at again after the read: the mixer may have stored a run of its
  // own in the meantime, and that one is the singer's.
  if ((await loadPitchAnalysisFromDbStrict(sessionId)) !== null) return false
  await savePitchAnalysisToDbStrict(sessionId, {
    mergedNotes: parsed.mergedNotes,
    segmentedNotes: parsed.segmentedNotes,
    // Derived exactly as an analysis run derives it before storing.
    pitchHistory: pitchHistoryFromNotes(parsed.segmentedNotes),
    keyRegions: parsed.keyRegions,
  })
  return true
}
