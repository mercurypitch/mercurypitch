// ============================================================
// assert-no-portable-console — the debug console must not ship
// ============================================================
//
// The portable console wraps every `console.*` call in the app and renders the
// result on screen with a Copy button. It exists for a device that cannot be
// plugged into an inspector, and it has no business in front of anybody else.
//
// The gate is a build constant, so a normal build folds
// the flag check to `if (false)` and drops the dynamic import — the
// module never enters the graph. That is the design; this is the proof, and
// it runs on every `pnpm run build`. A guard nobody checks is a guard that
// stops holding the moment someone writes `if (FLAG || debug)`.
//
// The native app's test builds carry the console on purpose, and with it the
// Developer screen (apps/mercurypitch). Its store build carries neither:
// .github/workflows/mercurypitch-mobile.yml runs this over a production
// store binary's dist, and its fingerprints cover that screen too.
//
// A store binary is held to one thing more, which is what `--store-binary`
// adds: the FLOATING developer console, the panel Settings' developer tools
// switch on over every page. The web ships it, so the default set cannot
// name it, but in the native app it is a test build's like the rest, armed
// behind the same flag (apps/mercurypitch/src/main.tsx). The crash card's
// inline log (src/components/ConsoleLog.tsx) is not it and ships everywhere.
//
// Usage: node scripts/assert-no-portable-console.mjs <dist-dir> [--store-binary]

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const STORE_BINARY_FLAG = '--store-binary'

const args = process.argv.slice(2)
const unknown = args.filter(
  (arg) => arg.startsWith('--') && arg !== STORE_BINARY_FLAG,
)
const dirs = args.filter((arg) => !arg.startsWith('--'))
if (unknown.length > 0 || dirs.length > 1) {
  // Refused, not ignored: a misspelt flag would otherwise check a store
  // binary as a web build and pass the console it is there to catch.
  console.error(
    `assert-no-portable-console: cannot read ${[...unknown, ...dirs.slice(1)].join(' ')}\n` +
      `Usage: node scripts/assert-no-portable-console.mjs <dist-dir> [${STORE_BINARY_FLAG}]`,
  )
  process.exit(2)
}
const root = dirs[0] ?? 'dist'
const storeBinary = args.includes(STORE_BINARY_FLAG)

/**
 * Strings that only exist inside the portable console's own module, and in
 * the Developer screen's Karaoke audio switches and record
 * (src/features/stem-mixer/stream-switches.ts, stem-load-path.ts): those are
 * read only in a native build with the console, so the web carries none.
 * Then the Developer screen itself and each section the native entry
 * registers on it, by the test id each one's markup carries: the screen
 * (apps/mercurypitch/src/shell/DeveloperScreen.tsx), native sign-in
 * (src/features/account/NativeSignInPanel.tsx), the audio record
 * (AudioDiagnosticsPanel.tsx) and the Karaoke audio switches
 * (KaraokeAudioPanel.tsx). Nothing the web imports reaches any of them.
 */
const FINGERPRINTS = [
  'MercuryPitch portable console',
  'mp:portableConsole:log',
  'Portable console',
  '[Glassworks runner recovery]',
  '[Glassworks runner input]',
  'mp:dev-karaoke-force-no-stream',
  'mp:dev-karaoke-decode-past-guard',
  'mp:dev-karaoke-last-song-path',
  'shell-developer',
  'native-signin-result',
  'dev-audio-report',
  'dev-karaoke-audio',
]

/**
 * The floating developer console, checked in a store binary only: its panel
 * by test id (src/components/FloatingConsole.tsx), the host it appends to
 * <body>, and the persisted switch that arms it (src/lib/developer-console.ts),
 * which is also the one key settings sync keeps device-local wherever the
 * panel exists (src/db/services/settings-service.ts). None of them is in
 * the crash card's inline log.
 */
const STORE_BINARY_FINGERPRINTS = [
  'floating-console',
  'mp-developer-console-host',
  'pitchperfect_developer_console',
]

const needles = storeBinary
  ? [...FINGERPRINTS, ...STORE_BINARY_FINGERPRINTS]
  : FINGERPRINTS

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
  for (const needle of needles) {
    if (text.includes(needle)) offenders.push(`${path}: ${needle}`)
  }
}

if (offenders.length > 0) {
  console.error(
    'The portable console or the Developer screen reached the build. The\n' +
      'console wraps console.* and shows a log on screen; the screen offers\n' +
      'developer sign-in and device records. Neither may be in front of a\n' +
      'visitor, or in a store binary.' +
      (storeBinary
        ? ' Nor may the floating developer\n' +
          'console, in a store binary: the native entry arms it only inside\n' +
          "its `if (import.meta.env.VITE_PORTABLE_CONSOLE === 'true')` branch,\n" +
          "the crash card's inline log (ConsoleLog.tsx) must not import it,\n" +
          'and its switch is named only where the panel exists. What keeps it\n' +
          'out is listed in docs/agent/DEVICE-DEBUGGING.md, "Which console is\n' +
          'in which build".'
        : '') +
      '\n\n' +
      offenders.map((line) => `  ${line}`).join('\n') +
      '\n\nBuilt with VITE_PORTABLE_CONSOLE set? That flag is for `pnpm run\n' +
      'dev:portable` and native test builds only; a native build with\n' +
      'MERCURYPITCH_API_TARGET=production compiles it out. If a call site\n' +
      'stopped being a plain\n' +
      "`if (import.meta.env.VITE_PORTABLE_CONSOLE === 'true')`, the bundler\n" +
      'can no longer prove the branch is dead and drop it.',
  )
  process.exit(1)
}

console.log(
  `assert-no-portable-console: clean${storeBinary ? ', as a store binary' : ''} (${root})`,
)
