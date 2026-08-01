// Find styles.X usages whose class is not defined in the imported module CSS.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

const roots = ['src']
const files = []
const walk = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e)
    const s = statSync(p)
    if (s.isDirectory()) walk(p)
    else if (/\.(tsx|ts)$/.test(e) && !/\.test\./.test(e)) files.push(p)
  }
}
roots.forEach(walk)

const cssClasses = (cssPath) => {
  const src = readFileSync(cssPath, 'utf8')
  const names = new Set()
  for (const m of src.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)) names.add(m[1])
  return names
}

let findings = 0
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  const imp = src.match(/import\s+(\w+)\s+from\s+'([^']+\.module\.css)'/)
  if (!imp) continue
  const [, ident, rel] = imp
  const cssPath = resolve(dirname(f), rel)
  let defined
  try { defined = cssClasses(cssPath) } catch { continue }
  const used = new Set()
  for (const m of src.matchAll(new RegExp(`\\b${ident}\\.([A-Za-z_][A-Za-z0-9_]*)`, 'g'))) used.add(m[1])
  for (const m of src.matchAll(new RegExp(`\\b${ident}\\[['"]([^'"]+)['"]\\]`, 'g'))) used.add(m[1])
  const missing = [...used].filter((c) => !defined.has(c))
  if (missing.length > 0) {
    findings += missing.length
    console.log(`${f} -> ${rel}: MISSING ${missing.join(', ')}`)
  }
}
console.log(`\n${findings} missing class reference(s)`)
