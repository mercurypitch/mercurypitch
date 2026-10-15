#!/usr/bin/env node
// Fold a sweep report into one line per distinct finding, so 160 WARN rows
// read as the handful of real things behind them.
//   node summarize.mjs <sweep-out>/report.json [--kind=clipped-text]
import { readFileSync } from 'node:fs'
const file = process.argv[2]
const kindArg = (process.argv.find((a) => a.startsWith('--kind=')) ?? '').slice(
  7,
)
const { items } = JSON.parse(readFileSync(file, 'utf8'))
const groups = new Map()
for (const it of items) {
  if (it.status === 'PASS') continue
  const [tag, kind] = it.id.split(' ')
  if (kindArg && kind !== kindArg) continue
  const rows = Array.isArray(it.details)
    ? it.details
    : [it.details ?? it.summary]
  for (const d of rows) {
    let key
    if (kind === 'clipped-text') key = `"${d.text}" ${d.how} @ ${d.el}`
    else if (kind === 'overlap')
      key = `${d.a} [${d.aText}] x ${d.b} [${d.bText}]`
    else if (kind === 'tap-targets')
      key = `${d.under24 ? '<24' : '<44'} "${d.text}" hit ${d.hit?.join('x')} @ ${d.el}`
    else if (kind === 'control-font') key = `"${d.text}" ${d.font} @ ${d.el}`
    else if (kind === 'focus-visible') {
      if (d.visible) continue
      key = `no focus change: ${d.el}`
    } else if (kind === 'errors') key = String(d).slice(0, 120)
    else key = typeof d === 'string' ? d : JSON.stringify(d).slice(0, 160)
    const k = `${kind} | ${key}`
    if (!groups.has(k)) groups.set(k, new Set())
    groups.get(k).add(tag)
  }
}
const out = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
for (const [k, tags] of out) {
  const list = [...tags]
  console.log(
    `${k}\n    on ${list.length}: ${list.slice(0, 8).join(', ')}${list.length > 8 ? ', ...' : ''}`,
  )
}
console.log(`\n${out.length} distinct findings`)
