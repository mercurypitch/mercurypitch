// Export the game's exact authored contours for the Merc singing production pass.
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileMelody, sampleMelodyAtTime, } from '../../../../packages/glass-game/src/core/melody-contour.ts'
import { glassMelody } from '../../../../packages/glass-game/src/content/melodies.ts'

const root = dirname(fileURLToPath(import.meta.url))
for (const [id, source] of [
  ['first-arc', 'light-a'],
  ['sunlit-steps', 'home-a'],
]) {
  const contour = compileMelody(glassMelody(id), { rootMidi: 50 })
  const points = Array.from(
    { length: Math.ceil(contour.durationSeconds / 0.005) + 1 },
    (_, index) => {
      const time = Math.min(contour.durationSeconds - 1e-8, index * 0.005)
      return { time, midi: sampleMelodyAtTime(contour, time).midi }
    },
  )
  await writeFile(
    join(root, 'analysis', `${source}-contour.json`),
    JSON.stringify({ source, contour, points }, null, 2) + '\n',
  )
}
