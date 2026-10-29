// ============================================================
// assert-experimental-features — prove a build lists, or keeps unlisted, its experimental pages
// ============================================================
//
// Every web build serves each experimental feature's page (Studio first), but
// lists it only where the build's default turns the features on
// (tools/experimental-features.ts): the dev deploy, PR previews and the e2e
// bundle, not mercurypitch.com. This reads a finished dist and checks every
// discovery surface against the state the caller expects, independently of
// the plugin that produced it:
//
// - served, always: the page's document and the service-worker rule for its
//   clean path, so the owner's runtime switch has an address to open;
// - the document's robots meta: `index, follow` or `noindex, follow`;
// - sitemap.xml, llms.txt, and every other document's prelude nav.
//
// The room's code ships either way, because the owner's switch can turn it
// on without a release, so there is no bundle fingerprint to check here; the
// default the bundle starts from is covered by the store's tests and
// src/e2e/experimental-features.spec.ts.
//
// Usage: node scripts/assert-experimental-features.mjs <dist-dir> --on|--off

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] ?? 'dist'
const mode = process.argv[3]
if (mode !== '--on' && mode !== '--off') {
  console.error(
    'Usage: node scripts/assert-experimental-features.mjs <dist-dir> --on|--off',
  )
  process.exit(2)
}
const on = mode === '--on'

/** Every experimental feature's pages: EXPERIMENTAL_ENTRY_SLUGS in tools/experimental-features.ts. */
const SLUGS = ['studio-night']

const failures = []
const read = (file) => readFileSync(join(root, file), 'utf8')
const documents = readdirSync(root).filter((file) => file.endsWith('.html'))

for (const slug of SLUGS) {
  const page = `${slug}.html`
  const link = new RegExp(`(?:href="|mercurypitch\\.com)/${slug}(?![\\w-])`)

  // Served either way: the document, and the worker rule that keeps the
  // service worker from answering the clean path with the app shell.
  if (!existsSync(join(root, page)))
    failures.push(`${page} is missing: /${slug} would not be served`)
  else {
    const robots = /<meta name="robots" content="([^"]*)"/.exec(read(page))?.[1]
    const expected = on ? 'index, follow' : 'noindex, follow'
    if (robots !== expected)
      failures.push(
        `${page} robots is "${robots ?? '(none)'}", expected "${expected}"`,
      )
  }
  if (existsSync(join(root, 'sw.js')) && !read('sw.js').includes(`/${slug}`))
    failures.push(`sw.js has no /${slug} rule`)

  for (const file of ['sitemap.xml', 'llms.txt']) {
    const has = link.test(read(file))
    if (has !== on)
      failures.push(`${file} ${has ? 'lists' : 'does not list'} /${slug}`)
  }

  const linking = documents.filter(
    (file) => file !== page && link.test(read(file)),
  )
  if (on) {
    for (const file of ['index.html', '404.html', 'mirror.html'])
      if (!linking.includes(file))
        failures.push(`${file} does not link /${slug}`)
  } else if (linking.length > 0) {
    failures.push(`these documents link /${slug}: ${linking.join(', ')}`)
  }
}

if (failures.length > 0) {
  console.error(
    `Experimental features should be ${on ? 'ON' : 'OFF'} in ${root}, but:\n\n` +
      failures.map((line) => `  ${line}`).join('\n') +
      '\n\nThe switch is VITE_EXPERIMENTAL_FEATURES, set per mode in\n' +
      '.env.development and .env.production; tools/experimental-features.ts\n' +
      'applies it to the build and src/stores/experimental-features-store.ts\n' +
      'to the bundle.',
  )
  process.exit(1)
}

console.log(
  `assert-experimental-features: ${on ? 'on, listed' : 'off, unlisted'}, still served (${root})`,
)
