// Studio command — serve the private editor or compile a local course with game-owned profiles.

import { readFile } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import { parseArgs } from 'node:util'
import { CLOUDWAY_STUDIO_LIMITS, cloudwayStudioCatalog, compileStudioDocument, summarizeStudioDocument, } from '../../packages/glass-game/src/authoring/cloudway-studio.ts'
import { createStudioServer } from './server.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    root: { type: 'string' },
    host: { type: 'string', default: '127.0.0.1' },
    port: { type: 'string', default: '5635' },
  },
})
const [command, file] = positionals
if (command === 'serve') {
  if (!values.root)
    throw new Error('Use --root to select the private editor directory.')
  const port = Number(values.port)
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('Port must be an integer between 1024 and 65535.')
  const localHosts = Object.values(networkInterfaces()).flatMap((entries) =>
    (entries ?? [])
      .filter((entry) => entry.family === 'IPv4')
      .map((entry) => entry.address),
  )
  if (
    !['127.0.0.1', 'localhost', '0.0.0.0', ...localHosts].includes(values.host!)
  )
    throw new Error('Use a local interface or 0.0.0.0 for the tablet preview.')
  const server = await createStudioServer({
    root: values.root,
    hosts: ['localhost', '127.0.0.1', ...localHosts],
  })
  server.on('error', (error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  server.listen(port, values.host, () =>
    console.log(
      `Private Cloudway Studio: http://${values.host}:${port}/ (Ctrl+C to stop)`,
    ),
  )
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => {
      server.close()
      server.closeAllConnections()
    })
} else if (command === 'catalog') {
  console.log(JSON.stringify(cloudwayStudioCatalog(), null, 2))
} else if (command === 'validate' || command === 'compile') {
  if (!file) throw new Error('Supply a course JSON file.')
  const bytes = await readFile(file)
  if (bytes.length > CLOUDWAY_STUDIO_LIMITS.maxBytes)
    throw new Error('Course document is too large.')
  const source: unknown = JSON.parse(bytes.toString('utf8'))
  console.log(
    JSON.stringify(
      command === 'compile'
        ? compileStudioDocument(source)
        : summarizeStudioDocument(source),
      null,
      2,
    ),
  )
} else {
  throw new Error(
    'Usage: cli.ts serve --root <private-editor> [--host 0.0.0.0 --port 5635] | catalog | validate <course.json> | compile <course.json>',
  )
}
