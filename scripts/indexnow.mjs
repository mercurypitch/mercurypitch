// ============================================================
// indexnow — tell Bing and the other IndexNow engines what changed
// ============================================================
//
// IndexNow (https://www.indexnow.org/documentation) lets a site tell Bing,
// Yandex, Seznam, Naver and Yep that a URL was added, updated or deleted,
// instead of waiting for a crawl. Copilot answers from Bing's index. Google
// does not take part.
//
// The key is public by design. public/<key>.txt holds it, and an engine
// fetches that file to check that a submission came from the site. This
// script finds the key by that file, so the key is written down once.
//
// What it sends:
//   --since <git-ref>  The sitemap URLs added, removed or given a new
//                      <lastmod> since that commit. The release workflow runs
//                      this after a production deploy, against the previous
//                      tag. If the key file was not in that commit, the key
//                      was not live then, so this is the first submission and
//                      it sends every sitemap URL.
//   <url> ...          Exactly these URLs, e.g. a page fixed by hand.
//   (nothing)          Every URL in the sitemap.
// --dry-run prints the request instead of sending it.
//
// Re-sending unchanged URLs on every release is noise
// (docs/plans/search-and-answer-engines.md §3.4), so a page's <lastmod> is
// what marks it changed: bump it when the page's words change.
//
// It sends the sitemap as production lists it. public/sitemap.xml names
// /glass-game, but the production build leaves it out of dist/sitemap.xml
// while VITE_GLASSWORKS_LISTED is off (tools/glassworks-listing.ts), so a
// release must not announce it either. The same goes for every experimental
// feature's page (/studio-night first) while VITE_EXPERIMENTAL_FEATURES is
// off (tools/experimental-features.ts).
//
// Usage: node scripts/indexnow.mjs [--dry-run] [--since <git-ref> | <url> ...]

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SITE = 'https://mercurypitch.com'
const HOST = new URL(SITE).host
const ENDPOINT = 'https://api.indexnow.org/indexnow'
const KEY_FILE = /^([a-f0-9]{32})\.txt$/
const SITEMAP = 'public/sitemap.xml'
const ENV_PRODUCTION = '.env.production'
const GLASSWORKS_URL = `${SITE}/glass-game`
/** Every experimental feature's page: EXPERIMENTAL_ENTRY_SLUGS in tools/experimental-features.ts. */
const EXPERIMENTAL_URLS = [`${SITE}/studio-night`]

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))

/** The key, from the one public/<key>.txt whose contents are its own name. */
export function findKey(publicDirectory = join(repoRoot, 'public')) {
  const keys = readdirSync(publicDirectory)
    .map((name) => KEY_FILE.exec(name)?.[1])
    .filter((key) => key !== undefined)
  if (keys.length !== 1) {
    throw new Error(
      `Expected one IndexNow key file (32 hex characters + .txt) in ${publicDirectory}, found ${keys.length}.`,
    )
  }
  const [key] = keys
  const contents = readFileSync(join(publicDirectory, `${key}.txt`), 'utf8')
  if (contents.trim() !== key) {
    throw new Error(`public/${key}.txt must contain exactly its own name.`)
  }
  return key
}

/** Each sitemap URL with its <lastmod> ('' when it has none), in order. */
export function sitemapEntries(xml) {
  const entries = new Map()
  const uncommented = xml.replace(/<!--[\s\S]*?-->/g, '')
  for (const [, body] of uncommented.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>\s*([^<\s]+)\s*<\/loc>/.exec(body)?.[1]
    if (loc === undefined) continue
    entries.set(
      loc,
      /<lastmod>\s*([^<\s]+)\s*<\/lastmod>/.exec(body)?.[1] ?? '',
    )
  }
  return entries
}

/** Whether a build switch in .env.production is on. As in the build tools,
 *  only "1" or "true" is: a lost variable keeps its pages unlisted. */
function switchOn(envProduction, name) {
  const value =
    new RegExp(`^[ \\t]*${name}[ \\t]*=(.*)$`, 'm').exec(envProduction)?.[1] ??
    ''
  const normalized = value
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase()
  return normalized === '1' || normalized === 'true'
}

/** The sitemap URLs production serves but does not list, from the contents
 *  of .env.production: the museum unless VITE_GLASSWORKS_LISTED lists it,
 *  and the experimental features' pages unless VITE_EXPERIMENTAL_FEATURES
 *  turns them on. */
export function unlistedUrls(envProduction) {
  const unlisted = new Set()
  if (!switchOn(envProduction, 'VITE_GLASSWORKS_LISTED'))
    unlisted.add(GLASSWORKS_URL)
  if (!switchOn(envProduction, 'VITE_EXPERIMENTAL_FEATURES'))
    for (const url of EXPERIMENTAL_URLS) unlisted.add(url)
  return unlisted
}

/** The sitemap as production lists it: its entries minus the unlisted URLs. */
export function listedEntries(xml, envProduction) {
  const unlisted = unlistedUrls(envProduction)
  return new Map([...sitemapEntries(xml)].filter(([loc]) => !unlisted.has(loc)))
}

/** The URLs added, removed or re-dated between two sitemaps. A removed URL
 *  is sent too: the engine fetches it, finds the 404 or the noindex, and
 *  drops it. */
export function changedUrls(before, after) {
  const changed = []
  for (const [loc, lastmod] of after) {
    if (before.get(loc) !== lastmod) changed.push(loc)
  }
  for (const loc of before.keys()) {
    if (!after.has(loc)) changed.push(loc)
  }
  return changed
}

/** The POST body. An engine refuses the whole request if one URL is off the
 *  key's host, so this refuses first, naming it. */
export function indexNowRequest(key, urls) {
  const foreign = urls.filter((url) => new URL(url).host !== HOST)
  if (foreign.length > 0) {
    throw new Error(`Not on ${HOST}: ${foreign.join(', ')}`)
  }
  return {
    host: HOST,
    key,
    keyLocation: `${SITE}/${key}.txt`,
    urlList: urls,
  }
}

/** A file as it was at `ref`, or undefined when it did not exist there. */
function fileAt(ref, path) {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return undefined
  }
}

/** Whether `ref` names a commit. Without this check a mistyped --since would
 *  read as "the key was not live then" and send every URL. */
export function refExists(ref) {
  try {
    execFileSync(
      'git',
      ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`],
      {
        cwd: repoRoot,
        stdio: 'ignore',
      },
    )
    return true
  } catch {
    return false
  }
}

const currentSitemap = () => readFileSync(join(repoRoot, SITEMAP), 'utf8')
const currentEnvProduction = () =>
  readFileSync(join(repoRoot, ENV_PRODUCTION), 'utf8')

/** What --since sends: the changes since `ref`, or everything when the key
 *  was not live at `ref`. Each side is read as production listed it then, so
 *  a URL whose listing flips is sent as added or removed. */
export function urlsSince(
  ref,
  key,
  read = fileAt,
  sitemap = currentSitemap(),
  envProduction = currentEnvProduction(),
) {
  const now = listedEntries(sitemap, envProduction)
  if (read(ref, `public/${key}.txt`) === undefined) return [...now.keys()]
  const before = listedEntries(
    read(ref, SITEMAP) ?? '',
    read(ref, ENV_PRODUCTION) ?? '',
  )
  return changedUrls(before, now)
}

export function parseArgs(args) {
  const dryRun = args.includes('--dry-run')
  const sinceAt = args.indexOf('--since')
  const since = sinceAt === -1 ? undefined : args[sinceAt + 1]
  if (sinceAt !== -1 && (since === undefined || since.startsWith('--'))) {
    throw new Error('--since needs a git ref, e.g. --since v0.9.21')
  }
  const urls = args.filter(
    (arg, index) =>
      !arg.startsWith('--') && (sinceAt === -1 || index !== sinceAt + 1),
  )
  if (since !== undefined && urls.length > 0) {
    throw new Error('Pass --since or URLs, not both.')
  }
  return { dryRun, since, urls }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const { dryRun, since, urls: given } = parseArgs(process.argv.slice(2))
    if (since !== undefined && !refExists(since)) {
      throw new Error(`--since ${since} is not a commit in this checkout.`)
    }
    const key = findKey()
    const urls =
      since !== undefined
        ? urlsSince(since, key)
        : given.length > 0
          ? given
          : [...listedEntries(currentSitemap(), currentEnvProduction()).keys()]
    if (urls.length === 0) {
      console.log(`[indexnow] Nothing changed in the sitemap since ${since}.`)
      process.exit(0)
    }
    const body = indexNowRequest(key, urls)
    if (dryRun) {
      console.log(JSON.stringify(body, null, 2))
      process.exit(0)
    }
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      // A hung endpoint must not hold the release job for minutes.
      signal: AbortSignal.timeout(30_000),
    })
    // 200 and 202 both mean received; 202 while the key is still checked.
    if (response.status !== 200 && response.status !== 202) {
      throw new Error(
        `IndexNow answered ${response.status}: ${await response.text()}`,
      )
    }
    console.log(
      `[indexnow] Sent ${urls.length} URL(s), answer ${response.status}:\n${urls.join('\n')}`,
    )
  } catch (error) {
    console.error(
      `[indexnow] ${error instanceof Error ? error.message : error}`,
    )
    process.exit(1)
  }
}
