// Bundle the app's Merc renderer for tools/merc-pass.mjs: one IIFE per look that sets window.MercLib.
//
//   node tools/build-merc.mjs
//
// Reads (never changes) the MercuryPitch checkout: src/lib/merc/*.ts (the renderer) and
// src/features/lessons/kit/merc-warm.ts (Tavi's look), with the checkout's own tsconfig.json.
// Writes assets/merc-lib/merc-blue.js and merc-orange.js, and assets/merc-lib/BUILD.json (the
// commits it was built from, the esbuild version and each bundle's sha256).
//
// Recreated for Lesson 5 from what merc-pass.mjs expects of it (the original, Lesson 1's, was lost
// with Lesson 4's project):
//   window.MercLib = { mount, VIEWS, WARM, ... }   mount(el, opts) is src/lib/merc/renderer.ts's;
//                                                  WARM is the orange look, set with m.setLook(WARM)
//   window.__mercSparkles = false                  no celebration sparkles (Lesson 1 DECISIONS 23)
//   window.__mercArcs = v                          the sound arcs at v of their strength (0.5 while
//                                                  he talks, 1 on a sung note, 0 when he is silent)
// The two switches are build-time edits of the bundle's copy of src/lib/merc/sim.ts (SWAPS below);
// each must match exactly once, or the build stops.
// Tavi's warm light used to be a build-time swap of the shader's hard-coded cool constants. The
// app now carries it: the light Merc casts is a uniform set (LIGHT), and merc-warm.ts's WARM_LOOK
// swaps the whole set through setLook (its test holds her to the amber of the old swaps). So no
// shader text is swapped any more, and the two bundles hold the same code; each keeps its own file
// because merc-pass.mjs loads `merc-<variant>.js`.
// The checkout's tsconfig.json is named, so esbuild never picks up whichever tsconfig sits above the
// entry and the bundle does not depend on where this project lives (PRODUCTION-PIPELINE trap 16).
//
// Environment: MERCURYPITCH_REPO (the checkout; default the read-only main checkout below),
// ESBUILD_MODULE (default: this project's pinned esbuild in .node/, then the checkout's).

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const REPO = process.env.MERCURYPITCH_REPO ?? '/home/user/mercurypitch/.claude/worktrees/fix'
const ESBUILD =
  process.env.ESBUILD_MODULE ??
  [join(ROOT, '.node/node_modules/esbuild/lib/main.js'), join(REPO, 'node_modules/esbuild/lib/main.js')].find(existsSync)
if (!ESBUILD) throw new Error('no esbuild: set ESBUILD_MODULE, or npm install --prefix .node esbuild@0.25.12')
const esbuild = await import(pathToFileURL(ESBUILD).href)

const MERC = join(REPO, 'src/lib/merc')
const WARM = join(REPO, 'src/features/lessons/kit/merc-warm.ts')
const TSCONFIG = join(REPO, 'tsconfig.json')
for (const p of [MERC, WARM, TSCONFIG]) if (!existsSync(p)) throw new Error(`missing in the checkout: ${p}`)

// [what, the text in sim.ts, its replacement]
const SWAPS = [
  [
    '__mercSparkles: no celebration sparkles when false',
    "if (this.sparkleSide === 'none') {",
    "if (this.sparkleSide === 'none' || (globalThis as any).__mercSparkles === false) {",
  ],
  [
    '__mercArcs: the sound arcs scaled by the shot',
    '? [arcsSrc.c[0], arcsSrc.c[1], arcsSrc.intensity * arcsI, this.arcPhase]',
    '? [arcsSrc.c[0], arcsSrc.c[1], arcsSrc.intensity * arcsI * ((globalThis as any).__mercArcs ?? 1), this.arcPhase]',
  ],
]

const switches = {
  name: 'merc-film-switches',
  setup(build) {
    build.onLoad({ filter: /[\\/]src[\\/]lib[\\/]merc[\\/]sim\.ts$/ }, (args) => {
      let src = readFileSync(args.path, 'utf8')
      for (const [what, from, to] of SWAPS) {
        const n = src.split(from).length - 1
        if (n !== 1) throw new Error(`build-merc: "${what}" matched ${n} times in sim.ts (expected once); the renderer changed`)
        src = src.replace(from, to)
      }
      return { contents: src, loader: 'ts' }
    })
  },
}

const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8' }).trim()
const info = {
  repo: REPO,
  commit: git('rev-parse', '--short=9', 'HEAD'),
  mercLastChanged: git('log', '-1', '--format=%h', '--', 'src/lib/merc'),
  warmLastChanged: git('log', '-1', '--format=%h', '--', 'src/features/lessons/kit/merc-warm.ts'),
  esbuild: esbuild.version,
  built: new Date().toISOString(),
  switches: SWAPS.map(([what]) => what),
  bundles: {},
}

const out = join(ROOT, 'assets/merc-lib')
mkdirSync(out, { recursive: true })
for (const variant of ['blue', 'orange']) {
  const entry = [
    "import { mount } from './renderer'",
    "import { BG, LIGHT, LOOK, PALETTE, QUALITY, STATES, VIEWS } from './constants'",
    `import { WARM_LIGHT, WARM_LOOK } from ${JSON.stringify(WARM.replace(/\.ts$/, ''))}`,
    `;(window as any).MercLib = { variant: '${variant}', mount, VIEWS, STATES, QUALITY, LOOK, PALETTE, LIGHT, BG, WARM: WARM_LOOK, WARM_LIGHT }`,
  ].join('\n')
  const r = await esbuild.build({
    stdin: { contents: entry, resolveDir: MERC, sourcefile: `merc-${variant}-entry.ts`, loader: 'ts' },
    absWorkingDir: REPO, // the bundle's path comments are the checkout's own (src/lib/merc/...), wherever this runs
    bundle: true,
    format: 'iife',
    target: 'es2022',
    platform: 'browser',
    tsconfig: TSCONFIG,
    plugins: [switches],
    write: false,
    legalComments: 'none',
    banner: {
      js:
        `// Merc renderer (${variant}) for tools/merc-pass.mjs, built by tools/build-merc.mjs from ` +
        `${info.commit} (src/lib/merc last changed in ${info.mercLastChanged}). Generated: do not edit.`,
    },
    logLevel: 'warning',
  })
  const code = r.outputFiles[0].text
  writeFileSync(join(out, `merc-${variant}.js`), code)
  info.bundles[`merc-${variant}.js`] = { bytes: Buffer.byteLength(code), sha256: createHash('sha256').update(code).digest('hex') }
  console.log(`assets/merc-lib/merc-${variant}.js: ${(Buffer.byteLength(code) / 1024).toFixed(0)} KB`)
}
writeFileSync(join(out, 'BUILD.json'), JSON.stringify(info, null, 1) + '\n')
console.log(`built from ${info.commit} (src/lib/merc ${info.mercLastChanged}, merc-warm.ts ${info.warmLastChanged}) with esbuild ${info.esbuild}`)
