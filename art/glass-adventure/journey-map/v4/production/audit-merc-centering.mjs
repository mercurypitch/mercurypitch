// Audit the delivered mascot and its actual idle animation at every map destination.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const root = new URL('../../../../../', import.meta.url)
const gameRequire = createRequire(
  new URL('packages/glass-game/package.json', root),
)
const threeUrl = new URL(
  './three.module.js',
  pathToFileURL(gameRequire.resolve('three')),
).href
const { Box3, Vector3 } = await import(threeUrl)
const { GLTFLoader } = await import(
  pathToFileURL(gameRequire.resolve('three/addons/loaders/GLTFLoader.js')).href
)
const { build } = await import(
  createRequire(import.meta.resolve('vite')).resolve('esbuild')
)
const result = await build({
  stdin: {
    contents: `export { createJourneyMerc } from './packages/glass-game/src/journey/merc.ts';
      export { FLOATING_MUSEUM_JOURNEY } from './packages/glass-game/src/content/museum-journey.ts';`,
    resolveDir: fileURLToPath(root),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  packages: 'external',
  write: false,
})
const source = result.outputFiles[0].text.replaceAll(
  'from "three"',
  `from ${JSON.stringify(threeUrl)}`,
)
const { createJourneyMerc, FLOATING_MUSEUM_JOURNEY } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
)
const bytes = await readFile(
  new URL('apps/beside-cue/public/games/glass3d/merc.glb', root),
)
const document = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  '',
)
const merc = createJourneyMerc(
  { ...document, dispose() {} },
  FLOATING_MUSEUM_JOURNEY.stages[0],
)
const mesh = merc.root.getObjectByName('merc_body')
if (mesh === undefined)
  throw new Error('Delivered mascot is missing merc_body.')
const proofs = []
for (const stage of FLOATING_MUSEUM_JOURNEY.stages) {
  merc.setTarget(stage, true)
  const distances = []
  const bodyBottoms = []
  for (let frame = 0; frame < 240; frame++) {
    merc.update(1 / 60, false)
    merc.root.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(mesh, true)
    const centre = bounds.getCenter(new Vector3())
    distances.push(
      Math.hypot(centre.x - stage.position[0], centre.z - stage.position[2]),
    )
    bodyBottoms.push(bounds.min.y - (stage.position[1] + 0.16))
  }
  const maximumLateralOffset = Math.max(...distances)
  const minimumBodyClearance = Math.min(...bodyBottoms)
  if (maximumLateralOffset > 0.035 || minimumBodyClearance < 0)
    throw new Error(
      `Mascot does not stand safely at ${stage.id}: offset ${maximumLateralOffset}, clearance ${minimumBodyClearance}`,
    )
  proofs.push({
    stageId: stage.id,
    marker: stage.position,
    standingPoint: merc.root.position.toArray(),
    maximumLateralOffset,
    minimumBodyClearance,
  })
}
merc.dispose()
await writeFile(
  new URL('../proofs/merc-centering.json', import.meta.url),
  `${JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      evidence:
        'Actual delivered merc.glb, 240 animation frames per destination. Body footprint measured independently of the authored donor origin; tiny idle motion is preserved.',
      proofs,
    },
    null,
    2,
  )}\n`,
)
console.log(JSON.stringify(proofs))
