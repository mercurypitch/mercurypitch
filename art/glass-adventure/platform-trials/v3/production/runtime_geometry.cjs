#!/usr/bin/env node
/* Remove unused tangent payload or normalize runtime texture names without changing geometry. */

const path = require('node:path')
const { createRequire } = require('node:module')

const [mode, input, output] = process.argv.slice(2)
if (
  !['strip-tangents', 'finalize-texture-names'].includes(mode) ||
  !input ||
  !output
) {
  throw new Error(
    'usage: runtime_geometry.cjs <strip-tangents|finalize-texture-names> <input.glb> <output.glb>',
  )
}

const repo = path.resolve(__dirname, '../../../../..')
const requireFromCli = createRequire(
  path.join(
    repo,
    'node_modules/.pnpm/@gltf-transform+cli@4.4.2/node_modules/@gltf-transform/cli/package.json',
  ),
)
const { NodeIO } = requireFromCli('@gltf-transform/core')
const { ALL_EXTENSIONS } = requireFromCli('@gltf-transform/extensions')

async function main() {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const document = await io.read(path.resolve(input))
  let changed = 0
  let removedBytes = 0
  if (mode === 'strip-tangents') {
    for (const mesh of document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        const tangent = primitive.getAttribute('TANGENT')
        if (tangent === null) continue
        changed += 1
        removedBytes += tangent.getCount() * tangent.getElementSize() * 4
        primitive.setAttribute('TANGENT', null)
      }
    }
  } else {
    for (const texture of document.getRoot().listTextures()) {
      const name = texture.getName()
      if (!/-atlas-0[23]-2k$/i.test(name)) continue
      texture.setName(name.replace(/-2k$/i, '-1k'))
      changed += 1
    }
  }
  await io.write(path.resolve(output), document)
  process.stdout.write(`${JSON.stringify({ mode, changed, removedBytes })}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
