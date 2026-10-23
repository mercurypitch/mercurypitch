// ============================================================
// plan-cites — list, check and re-anchor the plan's citations of the code
// ============================================================
//
// The lesson packages cite the kit, the app and the plan's own files by
// `file:line`, and docs/plans/find-your-pitch/README.md ("How the plan cites
// the app") says how each is read: a bare citation in the working tree, one
// followed by "at `<sha>`" (or closing a list that is) at that commit. A
// shift alone keeps a wrong citation wrong, so every check here reads the
// cited lines by content: the words quoted with a citation must be in them,
// and they must sit inside the section the citation names.
//
// Two kinds of citation are history and are not read: a row marked
// "Superseded by", read at its file header's commit, and the notes in
// research/, snapshots that cite the commits their own headers name.
//
// Usage:
//   node scripts/plan-cites.mjs list [paths...]
//   node scripts/plan-cites.mjs check [--warn] [paths...]
//   node scripts/plan-cites.mjs reanchor --base <ref> [--write] [--warn] [paths...]
//
// Paths are Markdown files or folders; the default is every .md file under
// docs/plans/find-your-pitch. `check` prints one line per finding and exits
// 1 if there is any (0 with --warn). `reanchor` moves each citation into a
// file changed since <ref> by the lines added and removed above it, reports
// the ones whose cited lines changed, checks the moved ones by content, and
// with --write rewrites their digits in place; it exits 1 if it reports
// anything a person must read (0 with --warn).
//
// The base for `reanchor` is the last commit at which the documents matched
// the code: on a branch, usually `git merge-base origin/main HEAD`. Once a
// --write is committed, a later run takes that commit. A citation already
// re-anchored from the base is left and counted, so a run is safe to
// repeat; one written or edited since the base is reported, not moved.

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { checkCitation, format } from './plan-cites/check.mjs'
import { parseDoc } from './plan-cites/parse.mjs'
import { reanchor } from './plan-cites/reanchor.mjs'
import { openRepo } from './plan-cites/repo.mjs'

const PLAN = 'docs/plans/find-your-pitch'
const USAGE = `Usage:
  node scripts/plan-cites.mjs list [paths...]
  node scripts/plan-cites.mjs check [--warn] [paths...]
  node scripts/plan-cites.mjs reanchor --base <ref> [--write] [--warn] [paths...]

<ref> is the last commit at which the docs matched the code: on a branch,
usually \`git merge-base origin/main HEAD\`; once a --write is committed, a
later run takes that commit.`

const isSnapshot = (doc) => doc.startsWith(`${PLAN}/research/`)

function fail(message) {
  console.error(message)
  process.exit(2)
}

const [command, ...rest] = process.argv.slice(2)
const flags = new Set(rest.filter((a) => a.startsWith('--')))
const baseAt = rest.indexOf('--base')
const base = baseAt === -1 ? undefined : rest[baseAt + 1]
const paths = rest.filter(
  (a, i) => !a.startsWith('--') && !(baseAt !== -1 && i === baseAt + 1),
)
if (!['list', 'check', 'reanchor'].includes(command)) fail(USAGE)
if (command === 'reanchor' && (base === undefined || base.startsWith('--')))
  fail(USAGE)

const top = spawnSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
})
if (top.status !== 0) fail('plan-cites: run it inside the repository')
const repo = openRepo(top.stdout.trim())

function markdownUnder(abs) {
  if (!existsSync(abs)) fail(`plan-cites: ${abs} does not exist`)
  if (!statSync(abs).isDirectory()) return [abs]
  return readdirSync(abs, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) =>
      e.isDirectory()
        ? markdownUnder(join(abs, e.name))
        : e.name.endsWith('.md')
          ? [join(abs, e.name)]
          : [],
    )
}

const docs = (
  paths.length > 0 ? paths.map((p) => resolve(p)) : [join(repo.root, PLAN)]
)
  .flatMap(markdownUnder)
  .map((abs) => relative(repo.root, abs).split('\\').join('/'))

if (command === 'list') {
  for (const doc of docs) {
    for (const c of parseDoc(readFileSync(join(repo.root, doc), 'utf8'))) {
      const r =
        c.token === null
          ? { unbound: true }
          : repo.resolve(c.token, doc, c.pin ?? '', c.earlier)
      const why = ['unbound', 'pattern', 'missing', 'ambiguous'].find(
        (k) => r[k] !== undefined,
      )
      const file = r.path ?? `${c.token ?? ''} (${why})`
      const range =
        c.from === c.to && !c.range ? `${c.from}` : `${c.from}-${c.to}`
      const note = isSnapshot(doc)
        ? 'snapshot'
        : c.superseded
          ? 'superseded'
          : ''
      const quotes = c.quotes
        .map((q) => `"${q.replace(/\s+/g, ' ')}"`)
        .join(' ')
      console.log(
        [
          `${doc}:${c.line}`,
          `${file}:${range}`,
          c.pin ? `at ${c.pin}` : '',
          note,
          quotes,
        ].join('\t'),
      )
    }
  }
  process.exit(0)
}

const counts = {}
let total = 0
const report = (f) => {
  counts[f.kind] = (counts[f.kind] ?? 0) + 1
  total++
  console.log(format(f))
}
const summary = () =>
  Object.entries(counts)
    .map(([k, n]) => `${k} ${n}`)
    .join(', ')

if (command === 'check') {
  let read = 0
  let pinned = 0
  const history = { superseded: 0, snapshot: 0 }
  for (const doc of docs) {
    for (const c of parseDoc(readFileSync(join(repo.root, doc), 'utf8'))) {
      if (isSnapshot(doc)) history.snapshot++
      else if (c.superseded) history.superseded++
      else {
        read++
        if (c.pin !== null) pinned++
        checkCitation(repo, doc, c).forEach(report)
      }
    }
  }
  console.error(
    `plan-cites: ${read} citations read (${pinned} pinned), ${total} findings${total ? ` (${summary()})` : ''}; ` +
      `not read: ${history.superseded} in superseded rows, ${history.snapshot} in research snapshots`,
  )
  process.exit(total > 0 && !flags.has('--warn') ? 1 : 0)
}

if (!repo.isCommit(base)) fail(`plan-cites: ${base} is not a commit`)
const { events, moved, already } = reanchor(repo, base, docs, {
  write: flags.has('--write'),
  skip: isSnapshot,
})
for (const e of events) report(e)
// a shift keeps a wrong citation wrong, on a re-run as on the first run
for (const m of [...moved, ...already])
  checkCitation(repo, m.doc, m.cite, m.from, m.to).forEach(report)
// everything but a move is for a person to read
const hand = total - moved.length
delete counts.moved
console.error(
  `plan-cites: from ${base}, ${moved.length} moved, ${already.length} already re-anchored, ` +
    `${hand} reported${hand ? ` (${summary()})` : ''}` +
    `${flags.has('--write') && moved.length ? `; wrote ${moved.length}` : ''}`,
)
process.exit(hand > 0 && !flags.has('--warn') ? 1 : 0)
