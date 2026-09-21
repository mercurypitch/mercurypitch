// Stable LAN playtest server — keep development routes available without hot reload.
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createServer } from 'vite'

const { values } = parseArgs({
  options: {
    host: { type: 'string', default: '0.0.0.0' },
    port: { type: 'string', default: '5300' },
    https: { type: 'boolean', default: false },
  },
})
const port = Number(values.port)
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Choose a port between 1024 and 65535.')
process.env.VITE_BESIDE_CUE_GAMES = '1'
const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)),
  mode: values.https ? 'https' : 'development',
  server: {
    host: values.host,
    port,
    strictPort: true,
    hmr: false,
    watch: null,
  },
})
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    void server.close().then(() => process.exit(0))
  })
await server.listen()
server.printUrls()
console.log(
  'Hot reload is disabled. Restart this server to load edited modules.',
)
