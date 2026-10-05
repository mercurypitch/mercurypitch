// Stable LAN playtest server — keep development routes available without hot reload.
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createServer } from 'vite'
import { glassPlaytestFileRoots } from './glass-playtest-files.ts'

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
process.env.VITE_PORTABLE_CONSOLE ??= 'true'
const appRoot = fileURLToPath(new URL('..', import.meta.url))
const server = await createServer({
  root: appRoot,
  // A no-HMR playtest must not share optimized dependencies with Playwright or
  // the ordinary Vite server. Their config hashes differ; rewriting this cache
  // underneath a running preview can load duplicate Solid runtimes and mount
  // effects before their DOM refs exist. Separate ports also isolate previews.
  cacheDir: fileURLToPath(
    new URL(`../node_modules/.vite/glass-playtest-${port}`, import.meta.url),
  ),
  mode: values.https ? 'https' : 'development',
  // Private mounted galleries share the app renderer without allowing their parents.
  resolve: { dedupe: ['three'] },
  server: {
    host: values.host,
    port,
    strictPort: true,
    hmr: false,
    watch: null,
    fs: { strict: true, allow: glassPlaytestFileRoots(appRoot) },
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
