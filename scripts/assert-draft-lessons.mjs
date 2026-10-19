// ============================================================
// assert-draft-lessons — prove a build shows, or hides, the draft lessons
// ============================================================
//
// A draft lesson (src/features/lessons/kit/drafts.ts) is built, routed and
// linked only where the build switch says so (tools/draft-lessons.ts): shown
// for the dev deploy, PR previews and the e2e bundle, hidden for
// mercurypitch.com. This reads a finished dist and checks every draft
// against the state the caller expects, independently of the build that
// produced it:
//
// - its document, learn/NN.html: present when shown, absent when hidden;
// - its path in the bundle: when shown, the season map's entry links it;
//   when hidden, no script in dist/assets and no document carries
//   `/learn/NN` at all, so no page on the site can link it;
// - sitemap.xml and llms.txt: never list a draft (they gain it at release);
// - the service worker: leaves the path to the network in both states, so a
//   hidden draft's address reaches the 404 page, not the app shell;
// - and no document still carries both readings of a lesson's state (a
//   `data-if-live` or `data-if-planned` span the build should have kept or
//   dropped).
//
// And every lesson page in the repository that is not a draft is in the
// build either way, so releasing a lesson, which deletes its line from
// drafts.ts, puts it on the live site rather than off every build.
//
// Source maps are not read: they carry the season map's source text, page
// and all, and nothing links to them.
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

const read = (file) => readFileSync(join(root, file), 'utf8')

function* files(dir, test) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* files(path, test)
    else if (test(name)) yield path
  }
}

const relative = (path) => path.slice(root.length).replace(/^[\\/]/, '')
const scripts = [...files(join(root, 'assets'), (n) => n.endsWith('.js'))]
const documents = [...files(root, (n) => n.endsWith('.html'))].filter(
  (path) => !relative(path).startsWith('assets'),
)

const failures = []

for (const n of drafts) {
  const nn = String(n).padStart(2, '0')
  const path = `/learn/${nn}`
  const document = `learn/${nn}.html`
  // `/learn/03`, but not `/learn/030`
  const mention = new RegExp(`/learn/${nn}(?!\\d)`)
  const carrying = (list) =>
    list.filter((file) => mention.test(readFileSync(file, 'utf8')))

  const built = existsSync(join(root, document))
  if (built !== shown)
    failures.push(
      `${document} is ${built ? 'in' : 'missing from'} the build: the draft would ${built ? 'be served' : 'not be served'}`,
    )

  const linkingScripts = carrying(scripts)
  if (shown && linkingScripts.length === 0)
    failures.push(
      `no script in assets/ carries ${path}: the season map does not link the draft`,
    )
  if (!shown && linkingScripts.length > 0)
    failures.push(
      `these scripts still carry ${path}: ${linkingScripts.map(relative).join(', ')}`,
    )

  if (!shown) {
    const linkingDocuments = carrying(documents)
    if (linkingDocuments.length > 0)
      failures.push(
        `these documents still carry ${path}: ${linkingDocuments.map(relative).join(', ')}`,
      )
  }

  for (const listing of ['sitemap.xml', 'llms.txt']) {
    if (existsSync(join(root, listing)) && mention.test(read(listing)))
      failures.push(
        `${listing} lists ${path}, which waits on ${DRAFT_LESSONS[n]}`,
      )
  }

  if (existsSync(join(root, 'sw.js')) && !mention.test(read('sw.js')))
    failures.push(
      `sw.js has no ${path} rule: the service worker would answer it with the app shell`,
    )
}

// A page that says which lessons are ready writes both readings, and the
// build keeps the true one (lessonStatesPlugin, tools/draft-lessons.ts): a
// document still carrying a reading would say both.
const unresolved = documents.filter((file) =>
  /data-if-(?:live|planned)=/.test(readFileSync(file, 'utf8')),
)
if (unresolved.length > 0)
  failures.push(
    `these documents still carry both readings of a lesson's state: ${unresolved.map(relative).join(', ')}`,
  )

// The repository's own lesson pages, learn/NN.html, not the dist's.
const learn = new URL('../learn/', import.meta.url)
const live = (existsSync(learn) ? readdirSync(learn) : [])
  .map((name) => /^(\d{2})\.html$/.exec(name)?.[1])
  .filter((nn) => nn !== undefined && !drafts.includes(Number(nn)))
  .sort()
for (const nn of live) {
  if (!existsSync(join(root, `learn/${nn}.html`)))
    failures.push(
      `learn/${nn}.html is missing from the build: lesson ${Number(nn)} is no draft, so every build serves it`,
    )
}

if (failures.length > 0) {
  console.error(
    `The draft lessons should be ${shown ? 'SHOWN' : 'HIDDEN'} in ${root}, but:\n\n` +
      failures.map((line) => `  ${line}`).join('\n') +
      '\n\nThe switch is VITE_DRAFT_LESSONS, set per mode in .env.development\n' +
      'and .env.production; the list is src/features/lessons/kit/drafts.ts,\n' +
      'tools/draft-lessons.ts applies it to the build, and each draft\n' +
      "lesson's season entry folds its page away where drafts are hidden.",
  )
  process.exit(1)
}

const liveLine = `live lesson ${live.map(Number).join(', ') || 'none'}`
console.log(
  drafts.length === 0
    ? `assert-draft-lessons: no draft lessons, ${liveLine} (${root})`
    : `assert-draft-lessons: ${shown ? 'shown' : 'hidden'}, lesson ${drafts.join(', ')}; ${liveLine} (${root})`,
)
