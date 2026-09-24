// Export compact variants from the same compiler used by the ribbon, guide and judge.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileMelody, sampleMelodyAtTime, } from '../../../../packages/glass-game/src/core/melody-contour.ts'
import { glassMelody } from '../../../../packages/glass-game/src/content/melodies.ts'

const root = dirname(fileURLToPath(import.meta.url))
const plan = JSON.parse(await readFile(join(root, 'phrase-plan.json'), 'utf8'))
const variants = []
const paceCode = (pace) => String(Math.round(pace * 100)).padStart(3, '0')
for (const phrase of plan.phrases) {
  for (
    let rootMidi = plan.supported_root_midi.minimum;
    rootMidi <= plan.supported_root_midi.maximum;
    rootMidi++
  ) {
    for (const pace of plan.supported_paces) {
      const contour = compileMelody(glassMelody(phrase.melody_id), {
        rootMidi,
        pace,
        samplesPerSecond: 200,
      })
      const probes = Array.from({ length: 25 }, (_, index) => {
        const timeSeconds = (index / 24) * contour.durationSeconds
        const point = sampleMelodyAtTime(contour, timeSeconds)
        return { timeSeconds, midi: point.midi, kind: point.kind }
      })
      variants.push({
        id: `${phrase.melody_id}-r${rootMidi}-p${paceCode(pace)}`,
        phraseId: phrase.id,
        melodyId: phrase.melody_id,
        rootMidi,
        pace,
        durationSeconds: contour.durationSeconds,
        minimumMidi: contour.minimumMidi,
        maximumMidi: contour.maximumMidi,
        anchors: contour.anchors,
        segments: contour.segments,
        probes,
      })
    }
  }
}
await mkdir(join(root, 'analysis'), { recursive: true })
await writeFile(
  join(root, 'analysis', 'compiled-contours.json'),
  `${JSON.stringify({ revision: plan.revision, variants }, null, 2)}\n`,
)
console.log(JSON.stringify({ variants: variants.length }))
