// Chord benchmark keeps exact-pitch/onset and sustained-set metrics separate, including false notes.
import type { PolyphonicNote } from '@/lib/transcription/basic-pitch-decoder'
import { scoreGuitarRecordingNotes } from './recording-benchmark'
import type { GuitarChordFixture } from './recording-chord-fixtures'

export function scoreGuitarChordCandidate(
  fixture: GuitarChordFixture,
  notes: readonly PolyphonicNote[],
) {
  const evidence = notes.map((note, index) => ({
    id: `candidate-${index}`,
    midi: note.midi,
    startFrame: note.startSeconds * fixture.sampleRate,
    endFrame: note.endSeconds * fixture.sampleRate,
    clarity: note.confidence,
    onset: 'attack' as const,
  }))
  const probes = fixture.probes.map((probe) => {
    const actual = [
      ...new Set(
        notes
          .filter(
            (note) =>
              note.startSeconds <= probe.seconds &&
              note.endSeconds > probe.seconds,
          )
          .map((note) => note.midi),
      ),
    ].sort((a, b) => a - b)
    return {
      ...probe,
      actual,
      exact:
        actual.length === probe.midis.length &&
        actual.every((midi, i) => midi === probe.midis[i]),
      missing: probe.midis.filter((midi) => !actual.includes(midi)),
      extra: actual.filter((midi) => !probe.midis.includes(midi)),
    }
  })
  return {
    notes: scoreGuitarRecordingNotes(
      fixture.notes,
      evidence,
      fixture.sampleRate,
    ),
    probes,
    exactSets: probes.filter((probe) => probe.exact).length,
    totalSets: probes.length,
    falseOctavesAtProbes: probes.reduce(
      (sum, probe) =>
        sum +
        probe.extra.filter((midi) =>
          probe.midis.some((expected) => Math.abs(midi - expected) === 12),
        ).length,
      0,
    ),
  }
}
