// ============================================================
// assert-no-portable-console — the debug console must not ship
// ============================================================
//
// `PORTABLE_CONSOLE` wraps every `console.*` call in the app and renders the
// result on screen with a Copy button. It exists for a device that cannot be
// plugged into an inspector, and it has no business in front of anybody else.
//
// The gate is a build constant, so a normal build folds
// `if (PORTABLE_CONSOLE)` to `if (false)` and drops the dynamic import — the
// module never enters the graph. That is the design; this is the proof, and
// it runs on every `pnpm run build`. A guard nobody checks is a guard that
// stops holding the moment someone writes `if (PORTABLE_CONSOLE || debug)`.
//
// Usage: node scripts/assert-no-portable-console.mjs <dist-dir>

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] ?? 'dist'

/** Strings that only exist inside the portable console's own module. */
const FINGERPRINTS = [
  'MercuryPitch portable console',
  'mp:portableConsole:log',
  'Portable console',
]

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* files(path)
    else if (/\.(js|css|html)$/.test(name)) yield path
  }
}

const offenders = []
for (const path of files(root)) {
  const text = readFileSync(path, 'utf8')
  for (const needle of FINGERPRINTS) {
    if (text.includes(needle)) offenders.push(`${path}: ${needle}`)
  }
}

if (offenders.length > 0) {
  console.error(
    'The portable console reached the build. It wraps console.* and shows a\n' +
      'log on screen; it must never be in front of a visitor.\n\n' +
      offenders.map((line) => `  ${line}`).join('\n') +
      '\n\nBuilt with VITE_PORTABLE_CONSOLE set? That flag is for `pnpm run\n' +
      'dev:portable` only. If a call site stopped being a plain\n' +
      '`if (PORTABLE_CONSOLE)`, the bundler can no longer drop it.',
  )
  process.exit(1)
}

console.log(`assert-no-portable-console: clean (${root})`)
