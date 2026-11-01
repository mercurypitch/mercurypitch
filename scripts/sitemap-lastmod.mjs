// ============================================================
// sitemap-lastmod — keep each sitemap <lastmod> honest to its page
// ============================================================
//
// A URL's <lastmod> in public/sitemap.xml is the day its page's document last
// changed in a way a reader or a crawler would notice: its words, its links,
// or its head and structured data. Only people moved the dates, and they went
// stale: three room pages gained their lesson links on 2026-10-26, the hub
// listed three more lessons by 2026-10-28, and the v0.9.27 release still told
// IndexNow that nothing had changed (scripts/indexnow.mjs reads only dates).
//
// This reads a production build (dist/, from `pnpm run build`), reduces each
// sitemap URL's document to what a crawler reads, and compares a fingerprint
// of that against the one recorded beside the URL's date in
// scripts/sitemap-fingerprints.json. Hashed asset names, build ids, scripts
// and styles are left out, so a rebuild that only reshuffles chunks changes
// nothing.
//
//   node scripts/sitemap-lastmod.mjs [dist]            check; fails on a page
//                                                      that changed without a
//                                                      new date
//   node scripts/sitemap-lastmod.mjs --update [dist]   date each changed page
//                                                      today (UTC), or
//                                                      --date YYYY-MM-DD
//   node scripts/sitemap-lastmod.mjs --digest <url> [dist]
//                                                      print what is compared
//
// `pnpm run sitemap:lastmod` builds for production and runs --update.
//
// The fingerprints are of the production build only. A dev or e2e build lists
// the museum and the experimental pages and shows the draft lessons, so its
// documents differ on purpose; the check refuses one.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { sitemapEntries } from './indexnow.mjs'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const SITEMAP = join(repoRoot, 'public/sitemap.xml')
const FINGERPRINTS = join(repoRoot, 'scripts/sitemap-fingerprints.json')
const SITE = 'https://mercurypitch.com'

// Head metadata a search engine or a link unfurl reads. theme-color, viewport
// and the like change how a page looks, not what it says.
const META_READ =
  /^(description|robots|googlebot|bingbot|keywords|author|og:|twitter:|article:|apple-itunes-app)/i
// Head links that point at another document rather than at a resource.
const LINK_READ = new Set([
  'canonical',
  'alternate',
  'prev',
  'next',
  'author',
  'license',
  'help',
  'privacy-policy',
  'terms-of-service',
])
// Vite's content hash: /assets/name-AbC_12-x.js becomes /assets/name.js.
const HASHED_ASSET = /(\/assets\/[^"'\s?#]*?)-[A-Za-z0-9_-]{8}(\.[a-z0-9]+)/g
// Elements whose contents are code, not words.
const NOT_WORDS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE'])
// Attributes that carry words a reader is given.
const WORD_ATTRIBUTES = ['alt', 'title', 'aria-label']

const unhash = (value) => value.replace(HASHED_ASSET, '$1$2')
const squash = (value) => value.replace(/\s+/g, ' ').trim()

/** JSON with its object keys sorted, so key order is not a change. */
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

/**
 * What a crawler reads in a document, one fact per line: the language, the
 * title, the head metadata and document links, each JSON-LD block, then the
 * body in order as its words, links and images. Everything compared is here,
 * so two documents with the same digest read the same.
 */
export function pageDigest(html) {
  const { document } = new JSDOM(html).window
  const lines = []
  lines.push(`lang: ${document.documentElement.getAttribute('lang') ?? ''}`)
  lines.push(`title: ${squash(document.title)}`)
  for (const meta of document.querySelectorAll('meta')) {
    const name = meta.getAttribute('name') ?? meta.getAttribute('property')
    if (name === null || !META_READ.test(name)) continue
    lines.push(
      `meta ${name}: ${unhash(squash(meta.getAttribute('content') ?? ''))}`,
    )
  }
  for (const link of document.querySelectorAll('link[rel]')) {
    const rels = (link.getAttribute('rel') ?? '').toLowerCase().split(/\s+/)
    if (!rels.some((rel) => LINK_READ.has(rel))) continue
    const extras = ['hreflang', 'type', 'media']
      .filter((name) => link.hasAttribute(name))
      .map((name) => ` ${name}=${link.getAttribute(name)}`)
      .join('')
    lines.push(
      `link ${rels.join(' ')}${extras}: ${unhash(link.getAttribute('href') ?? '')}`,
    )
  }
  for (const block of document.querySelectorAll(
    'script[type="application/ld+json"]',
  )) {
    let data
    try {
      data = stableJson(JSON.parse(block.textContent ?? ''))
    } catch {
      data = `unparsed ${squash(block.textContent ?? '')}`
    }
    lines.push(`json-ld: ${unhash(data)}`)
  }
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        const text = squash(child.textContent ?? '')
        if (text) lines.push(`text: ${text}`)
        continue
      }
      if (child.nodeType !== 1 || NOT_WORDS.has(child.tagName)) continue
      for (const name of WORD_ATTRIBUTES) {
        const value = child.getAttribute(name)
        if (value !== null && squash(value)) {
          lines.push(`${name}: ${squash(value)}`)
        }
      }
      if (child.tagName === 'A' && child.hasAttribute('href')) {
        lines.push(`a: ${unhash(child.getAttribute('href') ?? '')}`)
      }
      if (child.tagName === 'IMG' || child.tagName === 'SOURCE') {
        const src = child.getAttribute('src') ?? child.getAttribute('srcset')
        if (src !== null) lines.push(`img: ${unhash(squash(src))}`)
      }
      if (child.tagName === 'IFRAME' && child.hasAttribute('src')) {
        lines.push(`iframe: ${unhash(child.getAttribute('src') ?? '')}`)
      }
      walk(child)
    }
  }
  if (document.body) walk(document.body)
  return `${lines.join('\n')}\n`
}

/** A short, stable fingerprint of a document's digest. */
export function pageFingerprint(html) {
  return createHash('sha256')
    .update(pageDigest(html))
    .digest('hex')
    .slice(0, 16)
}

/** The built document that answers a sitemap URL: /learn/ is
 *  learn/index.html, every other path is <path>.html beside it. */
export function documentFor(url) {
  const path = new URL(url).pathname.replace(/^\/+/, '')
  if (path === '') return 'index.html'
  if (path.endsWith('/')) return `${path}index.html`
  return `${path}.html`
}

/** Every URL in the sitemap source, with its date. */
export function sitemapDates(xml = readFileSync(SITEMAP, 'utf8')) {
  return sitemapEntries(xml)
}

/** Each URL's fingerprint as built in `dist`. */
export function builtFingerprints(dist, urls) {
  const fingerprints = new Map()
  for (const url of urls) {
    const file = join(dist, documentFor(url))
    if (!existsSync(file)) {
      throw new Error(`${url} has no built document at ${file}.`)
    }
    fingerprints.set(url, pageFingerprint(readFileSync(file, 'utf8')))
  }
  return fingerprints
}

/**
 * What is wrong between the sitemap, the recorded fingerprints and the build:
 * a URL whose page changed while its date stayed, a URL dated differently from
 * its record, and a URL on one side only. Empty when all three agree.
 */
export function findProblems(dates, recorded, built) {
  const problems = []
  for (const [url, lastmod] of dates) {
    const record = recorded[url]
    if (record === undefined) {
      problems.push(`${url} has no recorded fingerprint.`)
      continue
    }
    if (built.get(url) !== record.fingerprint) {
      problems.push(
        `${url} changed since its <lastmod> ${lastmod}: its words, links or structured data are not what they were.`,
      )
    } else if (record.lastmod !== lastmod) {
      problems.push(
        `${url} is dated ${lastmod} in the sitemap but ${record.lastmod} in the record, and its page has not changed.`,
      )
    }
  }
  for (const url of Object.keys(recorded)) {
    if (!dates.has(url))
      problems.push(`${url} is recorded but not in the sitemap.`)
  }
  return problems
}

/**
 * The sitemap and record after an update: a changed page is dated `today`, an
 * unchanged one keeps the date the sitemap gives it (a date set by hand is
 * taken as meant), and every fingerprint is the build's. A URL with no record
 * yet, a new page, keeps the date it was added with.
 */
export function updated(xml, dates, recorded, built, today) {
  const record = {}
  let next = xml
  for (const [url, lastmod] of dates) {
    const changed =
      recorded[url] !== undefined &&
      recorded[url].fingerprint !== built.get(url)
    const date = changed ? today : lastmod
    record[url] = { lastmod: date, fingerprint: built.get(url) }
    if (date !== lastmod) next = redate(next, url, date)
  }
  return { xml: next, record }
}

/** The sitemap with one URL's <lastmod> replaced. */
export function redate(xml, url, date) {
  const loc = `<loc>${url}</loc>`
  const at = xml.indexOf(loc)
  if (at === -1) throw new Error(`${url} is not in the sitemap.`)
  const end = xml.indexOf('</url>', at)
  const body = xml.slice(at, end)
  const dated = /<lastmod>[^<]*<\/lastmod>/.test(body)
    ? body.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${date}</lastmod>`)
    : body.replace(loc, `${loc}\n    <lastmod>${date}</lastmod>`)
  return xml.slice(0, at) + dated + xml.slice(end)
}

/** A dev or e2e build lists pages production leaves out of its sitemap. */
function assertProductionBuild(dist) {
  const builtSitemap = join(dist, 'sitemap.xml')
  if (!existsSync(builtSitemap)) {
    throw new Error(`${dist} has no sitemap.xml: build it with pnpm run build.`)
  }
  const listed = [...sitemapEntries(readFileSync(builtSitemap, 'utf8')).keys()]
  if (listed.includes(`${SITE}/glass-game`)) {
    throw new Error(
      `${dist} is not a production build (it lists /glass-game). The fingerprints are of \`pnpm run build\`.`,
    )
  }
}

export function parseArgs(argv) {
  const args = [...argv]
  const take = (flag) => {
    const at = args.indexOf(flag)
    if (at === -1) return undefined
    const [, value] = args.splice(at, 2)
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${flag} needs a value.`)
    }
    return value
  }
  const digest = take('--digest')
  const date = take('--date')
  if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('--date takes YYYY-MM-DD.')
  }
  const unknown = args.filter(
    (arg) => arg.startsWith('--') && arg !== '--update',
  )
  if (unknown.length > 0) throw new Error(`Unknown option ${unknown[0]}.`)
  const positional = args.filter((arg) => !arg.startsWith('--'))
  return {
    update: args.includes('--update'),
    date,
    digest,
    dist: resolve(positional[0] ?? join(repoRoot, 'dist')),
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const { update, date, digest, dist } = parseArgs(process.argv.slice(2))
    if (digest !== undefined) {
      process.stdout.write(
        pageDigest(readFileSync(join(dist, documentFor(digest)), 'utf8')),
      )
      process.exit(0)
    }
    assertProductionBuild(dist)
    const xml = readFileSync(SITEMAP, 'utf8')
    const dates = sitemapDates(xml)
    const recorded = existsSync(FINGERPRINTS)
      ? JSON.parse(readFileSync(FINGERPRINTS, 'utf8'))
      : {}
    const built = builtFingerprints(dist, dates.keys())
    if (update) {
      const today = date ?? new Date().toISOString().slice(0, 10)
      const next = updated(xml, dates, recorded, built, today)
      if (next.xml !== xml) writeFileSync(SITEMAP, next.xml)
      writeFileSync(FINGERPRINTS, `${JSON.stringify(next.record, null, 2)}\n`)
      for (const [url, { lastmod }] of Object.entries(next.record)) {
        if (dates.get(url) !== lastmod) {
          console.log(
            `[sitemap-lastmod] ${url} ${dates.get(url)} -> ${lastmod}`,
          )
        }
      }
      console.log('[sitemap-lastmod] Updated.')
      process.exit(0)
    }
    const problems = findProblems(dates, recorded, built)
    if (problems.length > 0) {
      console.error(
        `[sitemap-lastmod] ${problems.join('\n[sitemap-lastmod] ')}\n` +
          '[sitemap-lastmod] Date the changed pages with `pnpm run sitemap:lastmod`, or with `node scripts/sitemap-lastmod.mjs --update` on a production dist. See the comment at the top of public/sitemap.xml.',
      )
      process.exit(1)
    }
    console.log(
      `[sitemap-lastmod] ${dates.size} URLs: every <lastmod> matches its page.`,
    )
  } catch (error) {
    console.error(
      `[sitemap-lastmod] ${error instanceof Error ? error.message : error}`,
    )
    process.exit(1)
  }
}
