// A sitemap date is worth something only while it moves with its page. These
// hold the digest to what a crawler reads (and not to what a rebuild
// reshuffles), the check to every way the sitemap, the record and the build
// can disagree, and the record to the sitemap as committed.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { sitemapEntries } from './indexnow.mjs'
import { documentFor, findProblems, pageDigest, pageFingerprint, parseArgs, redate, updated, } from './sitemap-lastmod.mjs'

const repoFile = (path) =>
  readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8')

const page = ({ asset = 'index-AbCd1234', words = 'Sing a note.' } = {}) => `
<!doctype html>
<html lang="en">
  <head>
    <title>Mirror | MercuryPitch</title>
    <meta name="description" content="See your voice." />
    <meta name="theme-color" content="#000" />
    <meta property="og:image" content="https://mercurypitch.com/mirror-og.png?v=1" />
    <link rel="canonical" href="https://mercurypitch.com/mirror" />
    <link rel="stylesheet" href="/assets/${asset}.css" />
    <script type="module" src="/assets/${asset}.js"></script>
    <script type="application/ld+json">{"name":"Voice Mirror","@type":"WebApplication"}</script>
  </head>
  <body>
    <main><h1>Voice Mirror</h1><p>${words}</p><a href="/learn/01">Lesson 1</a></main>
    <script>window.boot = 1</script>
  </body>
</html>`

test('a rebuild that only renames hashed assets keeps the fingerprint', () => {
  assert.equal(
    pageFingerprint(page({ asset: 'index-AbCd1234' })),
    pageFingerprint(page({ asset: 'index-Zz9_x-0q' })),
  )
})

test('a change to the words moves the fingerprint', () => {
  assert.notEqual(
    pageFingerprint(page()),
    pageFingerprint(page({ words: 'Sing two notes.' })),
  )
})

test('the digest holds the head, the structured data, the words and the links', () => {
  const digest = pageDigest(page())
  assert.match(digest, /^title: Mirror \| MercuryPitch$/m)
  assert.match(digest, /^meta description: See your voice\.$/m)
  assert.match(digest, /^link canonical: https:\/\/mercurypitch\.com\/mirror$/m)
  // Key order inside JSON-LD is not a change.
  assert.match(
    digest,
    /^json-ld: \{"@type":"WebApplication","name":"Voice Mirror"\}$/m,
  )
  assert.match(digest, /^text: Sing a note\.$/m)
  assert.match(digest, /^a: \/learn\/01$/m)
  assert.doesNotMatch(digest, /theme-color|stylesheet|window\.boot/)
})

test('each sitemap URL maps to the document the asset layer serves', () => {
  assert.equal(documentFor('https://mercurypitch.com/'), 'index.html')
  assert.equal(
    documentFor('https://mercurypitch.com/learn/'),
    'learn/index.html',
  )
  assert.equal(
    documentFor('https://mercurypitch.com/learn/01'),
    'learn/01.html',
  )
  assert.equal(
    documentFor('https://mercurypitch.com/karaoke-night'),
    'karaoke-night.html',
  )
})

const A = 'https://mercurypitch.com/a'
const B = 'https://mercurypitch.com/b'
const xml = `<urlset>
  <url>
    <loc>${A}</loc>
    <lastmod>2026-10-01</lastmod>
  </url>
  <url>
    <loc>${B}</loc>
    <lastmod>2026-10-02</lastmod>
  </url>
</urlset>`
const recorded = {
  [A]: { lastmod: '2026-10-01', fingerprint: 'aaaa' },
  [B]: { lastmod: '2026-10-02', fingerprint: 'bbbb' },
}

test('agreement between the sitemap, the record and the build passes', () => {
  const built = new Map([
    [A, 'aaaa'],
    [B, 'bbbb'],
  ])
  assert.deepEqual(findProblems(sitemapEntries(xml), recorded, built), [])
})

test('a page that changed under an old date fails, naming it', () => {
  const built = new Map([
    [A, 'aaaa'],
    [B, 'cccc'],
  ])
  const problems = findProblems(sitemapEntries(xml), recorded, built)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /\/b changed since its <lastmod> 2026-10-02/)
})

test('a date moved by hand without its record fails', () => {
  const built = new Map([
    [A, 'aaaa'],
    [B, 'bbbb'],
  ])
  const moved = redate(xml, A, '2026-10-20')
  const problems = findProblems(sitemapEntries(moved), recorded, built)
  assert.equal(problems.length, 1)
  assert.match(
    problems[0],
    /\/a is dated 2026-10-20 in the sitemap but 2026-10-01/,
  )
})

test('a URL on one side only fails', () => {
  const built = new Map([[A, 'aaaa']])
  const one = `<urlset><url><loc>${A}</loc><lastmod>2026-10-01</lastmod></url></urlset>`
  assert.match(
    findProblems(sitemapEntries(one), recorded, built).join('\n'),
    /\/b is recorded but not in the sitemap/,
  )
  assert.match(
    findProblems(sitemapEntries(xml), { [A]: recorded[A] }, built).join('\n'),
    /\/b has no recorded fingerprint/,
  )
})

test('an update dates only the changed page, and keeps a date set by hand', () => {
  const built = new Map([
    [A, 'aaaa'],
    [B, 'cccc'],
  ])
  const handDated = redate(xml, A, '2026-09-30')
  const next = updated(
    handDated,
    sitemapEntries(handDated),
    recorded,
    built,
    '2026-11-01',
  )
  assert.deepEqual(next.record, {
    [A]: { lastmod: '2026-09-30', fingerprint: 'aaaa' },
    [B]: { lastmod: '2026-11-01', fingerprint: 'cccc' },
  })
  assert.deepEqual(
    [...sitemapEntries(next.xml)],
    [
      [A, '2026-09-30'],
      [B, '2026-11-01'],
    ],
  )
  assert.deepEqual(
    findProblems(sitemapEntries(next.xml), next.record, built),
    [],
  )
})

test('a URL with no record yet keeps the date it was added with', () => {
  const built = new Map([
    [A, 'aaaa'],
    [B, 'bbbb'],
  ])
  const next = updated(
    xml,
    sitemapEntries(xml),
    { [A]: recorded[A] },
    built,
    '2026-11-01',
  )
  assert.equal(next.record[B].lastmod, '2026-10-02')
  assert.equal(next.xml, xml)
})

test('the options are read, and a bad one is refused', () => {
  assert.equal(
    parseArgs(['--update', '--date', '2026-11-01', 'out']).date,
    '2026-11-01',
  )
  assert.equal(parseArgs(['--update']).update, true)
  assert.match(parseArgs(['out']).dist, /out$/)
  assert.throws(() => parseArgs(['--date', '1 Nov']), /YYYY-MM-DD/)
  assert.throws(() => parseArgs(['--updat']), /Unknown option/)
})

test('the record dates every sitemap URL exactly as the sitemap does', () => {
  const dates = sitemapEntries(repoFile('public/sitemap.xml'))
  const record = JSON.parse(repoFile('scripts/sitemap-fingerprints.json'))
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(record).map(([url, r]) => [url, r.lastmod]),
    ),
    Object.fromEntries(dates),
  )
})
