// bench_publish.mjs — the glass look bench as a static folder for a hosted review page.
//
// node bench_publish.mjs --out dir --hero "Urn, rebuild=path.glb" [--hero "Urn, shipped=path.glb"]
//                        [--subtitle "Amber, round 1"] [--notes notes.html]
//
// Bundles apps/beside-cue/src/dev/glass-bench-hosted.ts (the bench plus the
// page's controls) into bench.js, embeds each vessel and the game's HDR as a
// script under files/ (hosted pages serve neither .glb nor .hdr), and writes
// index.html: the page itself, without the document skeleton a host adds. Publish
// the folder with index.html as the page and bench.js plus files/ beside it.
// --notes is an HTML fragment shown beside the bench (a round's findings).

import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { APP } from './game_server.mjs'

const args = process.argv.slice(2).reduce((all, arg, i, list) => {
  if (!arg.startsWith('--')) return all
  const key = arg.slice(2)
  all[key] = [...(all[key] ?? []), list[i + 1]]
  return all
}, {})
const one = (key, fallback) => args[key]?.[0] ?? fallback
const out = resolve(one('out', 'bench-hosted'))
mkdirSync(join(out, 'files'), { recursive: true })
// esbuild arrives with Vite; pnpm keeps it beside Vite's real path, not the link.
const { build } = createRequire(
  realpathSync(join(APP, 'node_modules/vite/package.json')),
)('esbuild')

await build({
  absWorkingDir: APP,
  entryPoints: [join(APP, 'src/dev/glass-bench-hosted.ts')],
  bundle: true,
  format: 'esm',
  minify: true,
  target: 'es2022',
  outfile: join(out, 'bench.js'),
  logLevel: 'warning',
})

const files = {}
function embed(url, path, name) {
  const script = `files/${name}.js`
  const base64 = readFileSync(path).toString('base64')
  writeFileSync(
    join(out, script),
    `(window.BENCH_FILES = window.BENCH_FILES || {})[${JSON.stringify(url)}] = '${base64}'\n`,
  )
  files[url] = script
}
const hdr = '/bench/golden-coast.hdr'
embed(
  hdr,
  join(APP, 'public/games/adventure-v2/environment/golden-coast.hdr'),
  'golden-coast-hdr',
)
const heroes = (args.hero ?? []).map((entry, index) => {
  const [label, path] = entry.split('=')
  const url = `/bench/hero-${index}.glb`
  embed(url, resolve(path), `hero-${index}`)
  return { label, url }
})
if (heroes.length === 0)
  throw new Error('give at least one --hero "Label=path.glb"')

const notes = args.notes ? readFileSync(one('notes'), 'utf8') : ''
const subtitle = one('subtitle', 'Amber, round 1')
const options = (pairs, selected) =>
  pairs
    .map(
      ([v, l]) =>
        `<option value="${v}"${v === selected ? ' selected' : ''}>${l}</option>`,
    )
    .join('')
const page = readFileSync(new URL('./bench_page.html', import.meta.url), 'utf8')
  .replace('{{SUBTITLE}}', subtitle)
  .replace('{{NOTES}}', notes)
  .replace('{{MANIFEST}}', JSON.stringify({ hdr, heroes, files }))
  .replace(
    '{{LOOKS}}',
    options(
      [
        ['authored', 'A · today (the vessel as authored)'],
        ['screen-amber', 'B · transmission over a lit liner'],
        ['studio-amber', 'C · glass that carries its own light'],
      ],
      one('look', 'studio-amber'),
    ),
  )
writeFileSync(join(out, 'index.html'), page)
console.log(
  `${out}: index.html, bench.js, ${Object.keys(files).length} embedded files`,
)
