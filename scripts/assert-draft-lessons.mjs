// ============================================================
// assert-draft-lessons — prove a build carries every lesson page, with the right default for drafts
// ============================================================
//
// Whether a lesson is live is the site worker's to say at run time, from the
// admin console's lesson state and its environment's default for drafts
// (src/lesson-gate.ts). So every build carries every lesson page, a draft
// (src/features/lessons/kit/drafts.ts) included, and what the build still
// decides is the default of a page no worker served: drafts shown for the
// dev deploy, PR previews and the e2e bundle, held back for mercurypitch.com
// (tools/draft-lessons.ts). This reads a finished dist and checks it against
// the default the caller expects, independently of the build that produced
// it:
//
// - every lesson page in the repository is in the build, learn/NN.html, and
//   so is 404.html, which the worker answers a lesson held back with;
// - every draft's path is in the bundle, so the season map can link it
//   wherever the state publishes it;
// - the bundle's default (kit/page-state.ts writes it as JSON text) is the
//   expected one: `"drafts":true` shown, `"drafts":false` held back;
// - sitemap.xml and llms.txt list no draft: the worker adds one to each only
//   while it is published;
// - no document outside learn/ carries a draft's address, since the worker
//   settles lesson pages by the state and no other document;
// - the service worker leaves every lesson path to the network, so a lesson
//   held back reaches the worker's 404 page, not the app shell;
// - each reading a page writes of another lesson's state is a
//   `<span data-if-live="N">` or `<span data-if-planned="N">` the worker and
//   the page's script can settle, and the build marked `hidden` exactly the
//   one that is false under its default.
//
// Source maps are not read: they carry the modules' source text, and
// nothing links to them.
//
// Usage: node scripts/assert-draft-lessons.mjs <dist-dir> --shown|--hidden

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DRAFT_LESSONS } from '../src/features/lessons/kit/drafts.ts'

const root = process.argv[2] ?? 'dist'
const mode = process.argv[3]
if (mode !== '--shown' && mode !== '--hidden') {
  console.error(
    'Usage: node scripts/assert-draft-lessons.mjs <dist-dir> --shown|--hidden',
  )
  process.exit(2)
}
const shown = mode === '--shown'

const drafts = Object.keys(DRAFT_LESSONS)
  .map(Number)
  .filter((n) => Number.isInteger(n) && DRAFT_LESSONS[n] !== undefined)
  .sort((a, b) => a - b)

// The repository's own lesson pages, learn/NN.html, not the dist's.
const learn = new URL('../learn/', import.meta.url)
const pages = (existsSync(learn) ? readdirSync(learn) : [])
  .map((name) => /^(\d{2})\.html$/.exec(name)?.[1])
  .filter((nn) => nn !== undefined)
  .map(Number)
  .sort((a, b) => a - b)
// Live on a page no worker served, by this build's default.
const liveByDefault = shown ? pages : pages.filter((n) => !drafts.includes(n))

const pad = (n) => String(n).padStart(2, '0')
// `/learn/03`, but not `/learn/030`
const mentionOf = (n) => new RegExp(`/learn/${pad(n)}(?!\\d)`)
const has = (file) => existsSync(join(root, file))
const read = (file) => readFileSync(join(root, file), 'utf8')

function* files(dir, test) {
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* files(path, test)
    else if (test(name)) yield path
  }
}

const relative = (path) =>
  path
    .slice(root.length)
    .replace(/^[\\/]/, '')
    .replace(/\\/g, '/')
const scripts = [...files(join(root, 'assets'), (n) => n.endsWith('.js'))]
const documents = [...files(root, (n) => n.endsWith('.html'))].filter(
  (path) => !relative(path).startsWith('assets/'),
)
const text = new Map()
const contents = (path) => {
  if (!text.has(path)) text.set(path, readFileSync(path, 'utf8'))
  return text.get(path)
}

const failures = []

for (const n of pages) {
  if (!has(`learn/${pad(n)}.html`))
    failures.push(
      `learn/${pad(n)}.html is missing from the build: every build carries every lesson page, and the site worker decides which are live`,
    )
}
if (!has('404.html'))
  failures.push(
    '404.html is missing from the build: the site worker answers a lesson held back with it',
  )

for (const n of drafts) {
  const path = `/learn/${pad(n)}`
  const mention = mentionOf(n)
  if (!scripts.some((file) => mention.test(contents(file))))
    failures.push(
      `no script in assets/ carries ${path}: the season map could not link the draft where the state publishes it`,
    )

  for (const listing of ['sitemap.xml', 'llms.txt']) {
    if (!has(listing)) continue
    if (mention.test(read(listing)))
      failures.push(
        `${listing} lists ${path}, which waits on ${DRAFT_LESSONS[n]}: the site worker adds it while it is published`,
      )
  }

  const carrying = documents.filter(
    (file) =>
      !relative(file).startsWith('learn/') && mention.test(contents(file)),
  )
  if (carrying.length > 0)
    failures.push(
      `these documents carry ${path}, and the site worker settles no document outside learn/ by the state: ${carrying.map(relative).join(', ')}`,
    )
}

for (const listing of ['sitemap.xml', 'llms.txt']) {
  if (!has(listing)) failures.push(`${listing} is missing from the build`)
}

// The default a page no worker served reads, as page-state.ts writes it;
// a minified chunk may escape the quotes.
const DEFAULT_STATE = /\\?"lessons\\?":\{\},\\?"drafts\\?":(true|false)\}/g
const defaults = new Map()
for (const file of scripts) {
  for (const match of contents(file).matchAll(DEFAULT_STATE)) {
    const value = match[1] === 'true'
    defaults.set(value, [...(defaults.get(value) ?? []), relative(file)])
  }
}
if (defaults.size === 0)
  failures.push(
    'no script in assets/ carries the default a page no worker served reads (kit/page-state.ts)',
  )
if (defaults.has(!shown))
  failures.push(
    `these scripts default to drafts ${shown ? 'held back' : 'shown'} on a page no worker served: ${[...new Set(defaults.get(!shown))].join(', ')}`,
  )

const sw = has('sw.js') ? read('sw.js') : null
if (sw === null) failures.push('sw.js is missing from the build')
for (const n of sw === null ? [] : pages) {
  for (const path of [`/learn/${pad(n)}`, `/learn/${pad(n)}.html`]) {
    if (!sw.includes(`"${path}"`) && !sw.includes(`'${path}'`))
      failures.push(
        `sw.js has no ${path} rule: where the lesson is held back, the service worker would answer it with the app shell`,
      )
  }
}

// Each reading as the worker and the page's script select it, in the one
// form both settle, with `hidden` on the reading that is false under this
// build's default (lessonStatesPlugin, tools/draft-lessons.ts).
const TAG = /<([a-z][a-z0-9-]*)\b([^>]*)>/gi
const READING = /^\s+data-if-(live|planned)="(\d{1,2})"(\s+hidden(?:="")?)?\s*$/
for (const file of documents) {
  const html = contents(file)
  for (const match of html.matchAll(TAG)) {
    const [opening, tag, attributes] = match
    if (!/\bdata-if-(?:live|planned)\b/i.test(attributes)) continue
    const where = `${relative(file)}: ${opening}`
    const form = tag.toLowerCase() === 'span' ? READING.exec(attributes) : null
    if (form === null) {
      failures.push(
        `${where} is a reading the worker and the page cannot both settle: it must be <span data-if-live="N"> with that one attribute`,
      )
      continue
    }
    const after = html.slice(match.index + opening.length)
    const close = after.search(/<\/span\s*>/i)
    if (close === -1 || /<span\b/i.test(after.slice(0, close))) {
      failures.push(`${where} holds a span, or is never closed`)
      continue
    }
    const [, reading, n, hidden] = form
    const holds = liveByDefault.includes(Number(n)) === (reading === 'live')
    if (holds === (hidden !== undefined))
      failures.push(
        `${where} is ${holds ? 'hidden, though it holds' : 'shown, though it is false'} under this build's default`,
      )
  }
}

if (failures.length > 0) {
  console.error(
    `Every lesson page should be in ${root}, with drafts ${shown ? 'SHOWN' : 'HELD BACK'} by default, but:\n\n` +
      failures.map((line) => `  ${line}`).join('\n') +
      '\n\nThe default is VITE_DRAFT_LESSONS, set per mode in .env.development\n' +
      'and .env.production; the list is src/features/lessons/kit/drafts.ts,\n' +
      'tools/draft-lessons.ts applies it to the build, and the site worker\n' +
      '(src/lesson-gate.ts) decides at run time which lessons are live.',
  )
  process.exit(1)
}

const list = (ns) => ns.join(', ') || 'none'
console.log(
  `assert-draft-lessons: drafts ${shown ? 'shown' : 'held back'} by default, ` +
    `lesson ${list(drafts)}; lesson pages ${list(pages)} built (${root})`,
)
