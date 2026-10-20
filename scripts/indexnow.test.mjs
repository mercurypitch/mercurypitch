// IndexNow is only believed when the key file the engines fetch holds the key
// that was sent, and a release should send only the pages that changed. These
// hold the key file to the protocol, and --since to the sitemap's own record
// of what changed. Nothing here reaches the network: the CLI case is a dry run.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { changedUrls, findKey, indexNowRequest, listedEntries, parseArgs, SITE, sitemapEntries, unlistedUrls, urlsSince, } from './indexnow.mjs'

const SCRIPT = fileURLToPath(new URL('./indexnow.mjs', import.meta.url))
const SITEMAP = readFileSync(
  fileURLToPath(new URL('../public/sitemap.xml', import.meta.url)),
  'utf8',
)
const ENV_PRODUCTION = readFileSync(
  fileURLToPath(new URL('../.env.production', import.meta.url)),
  'utf8',
)

const sitemap = (entries) =>
  `<urlset>${entries
    .map(
      ([loc, lastmod]) =>
        `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`,
    )
    .join('')}</urlset>`

test('the key file holds exactly its own name', () => {
  const key = findKey()
  assert.match(key, /^[a-f0-9]{32}$/)
})

test('a key file that does not hold its name is refused', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'indexnow-key-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const key = 'a'.repeat(32)
  writeFileSync(join(directory, `${key}.txt`), 'b'.repeat(32))
  assert.throws(() => findKey(directory), /must contain exactly its own name/)
})

test('every sitemap URL is on the key host, and the comments are skipped', () => {
  const urls = [...sitemapEntries(SITEMAP).keys()]
  assert.ok(urls.length > 0)
  assert.ok(urls.includes(`${SITE}/`))
  // The sitemap's comment names /exercises/<slug>, which is not a URL to send.
  assert.ok(urls.every((url) => !url.includes('<')))
  assert.doesNotThrow(() => indexNowRequest(findKey(), urls))
})

test('the request names the key file the site serves', () => {
  const key = 'c'.repeat(32)
  assert.deepEqual(indexNowRequest(key, [`${SITE}/mirror`]), {
    host: 'mercurypitch.com',
    key,
    keyLocation: `${SITE}/${key}.txt`,
    urlList: [`${SITE}/mirror`],
  })
  assert.throws(
    () => indexNowRequest(key, ['https://about.mercurypitch.com/']),
    /Not on mercurypitch\.com/,
  )
})

test('a release sends the pages added, re-dated or removed, and nothing else', () => {
  const before = sitemapEntries(
    sitemap([
      [`${SITE}/`, '2026-09-08'],
      [`${SITE}/mirror`, '2026-09-08'],
      [`${SITE}/old`, '2026-09-08'],
    ]),
  )
  const after = sitemapEntries(
    sitemap([
      [`${SITE}/`, '2026-09-08'],
      [`${SITE}/mirror`, '2026-10-19'],
      [`${SITE}/karaoke-app`, '2026-10-19'],
    ]),
  )
  assert.deepEqual(changedUrls(before, after), [
    `${SITE}/mirror`,
    `${SITE}/karaoke-app`,
    `${SITE}/old`,
  ])
  assert.deepEqual(changedUrls(after, after), [])
})

test('the first release with a key sends every URL; later ones the changes', () => {
  const key = 'd'.repeat(32)
  const now = sitemap([
    [`${SITE}/`, '2026-10-19'],
    [`${SITE}/jam`, '2026-09-08'],
  ])
  const previous = sitemap([
    [`${SITE}/`, '2026-09-08'],
    [`${SITE}/jam`, '2026-09-08'],
  ])
  const withoutKey = (_ref, path) =>
    path === 'public/sitemap.xml' ? previous : undefined
  assert.deepEqual(urlsSince('v1', key, withoutKey, now), [
    `${SITE}/`,
    `${SITE}/jam`,
  ])
  const withKey = (_ref, path) =>
    path === 'public/sitemap.xml' ? previous : key
  assert.deepEqual(urlsSince('v1', key, withKey, now), [`${SITE}/`])
})

// Glassworks is served in production but listed nowhere (tools/glassworks-
// listing.ts), and public/sitemap.xml still names it for the dev build.
test('production does not list Glassworks, so no release announces it', () => {
  const museum = `${SITE}/glass-game`
  assert.ok(sitemapEntries(SITEMAP).has(museum))
  assert.ok(!listedEntries(SITEMAP, ENV_PRODUCTION).has(museum))
  assert.equal(
    listedEntries(SITEMAP, ENV_PRODUCTION).size,
    sitemapEntries(SITEMAP).size - 1,
  )
  assert.deepEqual([...unlistedUrls('VITE_GLASSWORKS_LISTED=1')], [])
  assert.deepEqual([...unlistedUrls('VITE_GLASSWORKS_LISTED="true"\n')], [])
  // Only an explicit yes lists it: off, unset or garbled all hide it.
  for (const env of [
    'VITE_GLASSWORKS_LISTED=0',
    '',
    'VITE_GLASSWORKS_LISTED=yes',
  ]) {
    assert.deepEqual([...unlistedUrls(env)], [museum])
  }
})

test('a listing that flips is sent as an addition or a removal', () => {
  const key = 'e'.repeat(32)
  const museum = `${SITE}/glass-game`
  const map = sitemap([
    [`${SITE}/`, '2026-10-19'],
    [museum, '2026-10-19'],
  ])
  const readWith = (env) => (_ref, path) =>
    path === 'public/sitemap.xml' ? map : path === '.env.production' ? env : key
  const off = 'VITE_GLASSWORKS_LISTED=0'
  const on = 'VITE_GLASSWORKS_LISTED=1'
  // Unchanged pages, unchanged listing: nothing to send.
  assert.deepEqual(urlsSince('v1', key, readWith(off), map, off), [])
  // Listed now, hidden at the last release: announce it.
  assert.deepEqual(urlsSince('v1', key, readWith(off), map, on), [museum])
  // Hidden now, listed at the last release: send it, and the engine finds the noindex.
  assert.deepEqual(urlsSince('v1', key, readWith(on), map, off), [museum])
  // The first release with a key sends only what production lists.
  assert.deepEqual(
    urlsSince('v1', key, () => undefined, map, off),
    [`${SITE}/`],
  )
})

test('--since takes a ref, and URLs are not mixed with it', () => {
  assert.deepEqual(parseArgs([`${SITE}/jam`]), {
    dryRun: false,
    since: undefined,
    urls: [`${SITE}/jam`],
  })
  assert.deepEqual(parseArgs(['--dry-run', '--since', 'v0.9.21']), {
    dryRun: true,
    since: 'v0.9.21',
    urls: [],
  })
  assert.throws(() => parseArgs(['--since']), /needs a git ref/)
  assert.throws(() => parseArgs(['--since', 'v1', `${SITE}/jam`]), /not both/)
})

test('a dry run prints the request and sends nothing', () => {
  const result = spawnSync(
    process.execPath,
    [SCRIPT, '--dry-run', `${SITE}/karaoke-app`],
    { encoding: 'utf8' },
  )
  assert.equal(result.status, 0, result.stderr)
  const body = JSON.parse(result.stdout)
  assert.deepEqual(body.urlList, [`${SITE}/karaoke-app`])
  assert.equal(body.keyLocation, `${SITE}/${findKey()}.txt`)
})
