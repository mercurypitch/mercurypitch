#!/usr/bin/env node
// ============================================================
// How long is the user-facing changelog, per release?
// ============================================================
//
// CHANGELOG.md is rendered verbatim in the app's Changelog modal, so its
// length is a product decision rather than a formatting one. 0.9.0 shipped
// 110 bullets averaging 347 characters — engineering notes with a user
// audience, which is nobody's idea of release notes. 0.8.0 is the shape to
// aim for: 61 bullets, ~142 characters.
//
// This prints the numbers so /prod-upd can check rather than guess.
//
//   node scripts/changelog-stats.mjs            # every version
//   node scripts/changelog-stats.mjs 0.9.1      # one version
//
// Exits non-zero if a requested version averages over the budget, so it can
// stand in a release gate.

import { readFileSync } from 'node:fs'

/** A bullet that averages longer than this is carrying engineering detail. */
const BUDGET = 180

/** One entry per top-level bullet, continuation lines folded back on. */
function bulletsByVersion(markdown) {
  const versions = new Map()
  let current = null
  let open = null
  for (const line of markdown.split('\n')) {
    const heading = /^## \[([^\]]+)\] - (\S+)/.exec(line)
    if (heading) {
      current = { version: heading[1], date: heading[2], bullets: [] }
      versions.set(current.version, current)
      open = null
      continue
    }
    if (current === null) continue
    if (/^#{3} /.test(line)) {
      open = null
      continue
    }
    const bullet = /^- (.*)/.exec(line)
    if (bullet) {
      current.bullets.push(bullet[1])
      open = current.bullets.length - 1
      continue
    }
    const indented = /^\s{2,}(\S.*)$/.exec(line)
    if (indented && open !== null) {
      // Sub-bullets are their own line of prose, but they are read as part
      // of the entry they hang off, so they count towards it.
      current.bullets[open] += ` ${indented[1]}`
    }
  }
  return [...versions.values()]
}

const markdown = readFileSync('CHANGELOG.md', 'utf8')
const wanted = process.argv[2]
const all = bulletsByVersion(markdown)
const rows = wanted ? all.filter((v) => v.version === wanted) : all

if (rows.length === 0) {
  console.error(`no such version in CHANGELOG.md: ${wanted}`)
  process.exit(2)
}

let over = 0
console.log('version    date        bullets   avg   longest')
for (const { version, date, bullets } of rows) {
  if (bullets.length === 0) continue
  const total = bullets.reduce((sum, b) => sum + b.length, 0)
  const avg = Math.round(total / bullets.length)
  const longest = Math.max(...bullets.map((b) => b.length))
  const flag = avg > BUDGET ? '  <-- over budget' : ''
  if (avg > BUDGET) over += 1
  console.log(
    `${version.padEnd(10)} ${date.padEnd(11)} ${String(bullets.length).padStart(7)} ${String(avg).padStart(5)} ${String(longest).padStart(9)}${flag}`,
  )
}

if (wanted && over > 0) {
  console.error(
    `\n${wanted} averages over ${BUDGET} characters a bullet. Move the detail to dev-changelog.md.`,
  )
  process.exit(1)
}
