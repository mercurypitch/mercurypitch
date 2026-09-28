// ============================================================
// assert-glassworks-listing — prove a build lists, or hides, the museum
// ============================================================
//
// Glassworks is served by every web build, but only listed where the build
// switch says so (tools/glassworks-listing.ts): on for the dev deploy, PR
// previews and the e2e bundle, off for mercurypitch.com. This reads a finished
// dist and checks every discovery surface against the state the caller
// expects, independently of the plugin that produced it:
//
// - served, always: glass-game.html, its staged assets and the service-worker
//   rule for the clean path;
// - the entry document's robots meta: `index, follow` or `noindex, follow`;
// - sitemap.xml, llms.txt, and every other document's prelude nav;
// - the Home card and the Home tour step, by strings only they carry. The
//   switch is a build constant, so an unlisted bundle has none of them.
//
// Usage: node scripts/assert-glassworks-listing.mjs <dist-dir> --listed|--unlisted

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] ?? 'dist'
const mode = process.argv[3]
if (mode !== '--listed' && mode !== '--unlisted') {
  console.error(
    'Usage: node scripts/assert-glassworks-listing.mjs <dist-dir> --listed|--unlisted',
  )
  process.exit(2)
}
const listed = mode === '--listed'

/** Strings only the Home card and the Home tour steps put in the bundle. */
const HOME_FINGERPRINTS = [
  'Play Glassworks',
  'Explore four galleries with Merc',
  'A museum that listens',
  'Enter Glassworks with Merc',
  'Jump straight into Glassworks',
  '[data-tour="home.glassworks"]',
]

const LINK = /(?:href="|mercurypitch\.com)\/glass-game(?![\w-])/

const failures = []
const read = (file) => readFileSync(join(root, file), 'utf8')

// Served either way: the page, its assets, and the worker rule that keeps the
// service worker from answering the clean path with the app shell.
if (!existsSync(join(root, 'glass-game.html')))
  failures.push('glass-game.html is missing: /glass-game would not be served')
const assetDir = join(root, 'glass-game-assets')
if (!existsSync(assetDir) || readdirSync(assetDir).length === 0)
  failures.push('glass-game-assets/ is missing or empty')
if (existsSync(join(root, 'sw.js')) && !read('sw.js').includes('/glass-game'))
  failures.push('sw.js has no /glass-game rule')

if (existsSync(join(root, 'glass-game.html'))) {
  const robots = /<meta name="robots" content="([^"]*)"/.exec(
    read('glass-game.html'),
  )?.[1]
  const expected = listed ? 'index, follow' : 'noindex, follow'
  if (robots !== expected)
    failures.push(
      `glass-game.html robots is "${robots ?? '(none)'}", expected "${expected}"`,
    )
}

for (const file of ['sitemap.xml', 'llms.txt']) {
  const has = LINK.test(read(file))
  if (has !== listed)
    failures.push(`${file} ${has ? 'lists' : 'does not list'} /glass-game`)
}

const documents = readdirSync(root).filter(
  (file) => file.endsWith('.html') && file !== 'glass-game.html',
)
const linking = documents.filter((file) => LINK.test(read(file)))
if (listed) {
  for (const file of ['index.html', '404.html', 'mirror.html'])
    if (!linking.includes(file))
      failures.push(`${file} does not link /glass-game`)
} else if (linking.length > 0) {
  failures.push(`these documents link /glass-game: ${linking.join(', ')}`)
}

function* scripts(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* scripts(path)
    else if (name.endsWith('.js')) yield path
  }
}
const found = new Set()
for (const path of scripts(join(root, 'assets'))) {
  const text = readFileSync(path, 'utf8')
  for (const needle of HOME_FINGERPRINTS)
    if (text.includes(needle)) found.add(needle)
}
for (const needle of HOME_FINGERPRINTS) {
  if (listed && !found.has(needle))
    failures.push(`the bundle is missing "${needle}"`)
  if (!listed && found.has(needle))
    failures.push(`the bundle still carries "${needle}"`)
}

if (failures.length > 0) {
  console.error(
    `Glassworks should be ${listed ? 'LISTED' : 'UNLISTED'} in ${root}, but:\n\n` +
      failures.map((line) => `  ${line}`).join('\n') +
      '\n\nThe switch is VITE_GLASSWORKS_LISTED, set per mode in .env.development\n' +
      'and .env.production; tools/glassworks-listing.ts applies it to the\n' +
      'build and src/lib/glassworks-listing.ts to the bundle.',
  )
  process.exit(1)
}

console.log(
  `assert-glassworks-listing: ${listed ? 'listed' : 'unlisted'}, still served (${root})`,
)
