// ============================================================
// The Karaoke room's example songs: fetched, pinned, never committed
// ============================================================
//
//   node scripts/fetch-karaoke-examples.mjs          fetch what is missing
//   node scripts/fetch-karaoke-examples.mjs --check  verify, no network
//
// The room plays three songs by Josh Woodward (CC BY 4.0) from inside the
// app, so that a first launch with no network has something to sing (plan
// S8 §8, decision D13 A). Their six stems are 25.46 MiB of AAC. They do not
// go through the web app's public/: that would put them in every web deploy
// and in git history for good. They are fetched from the same R2 objects the
// web app streams, into the native-only asset root this app already ships
// from (`native-only/`, git-ignored for `*.m4a`), and every file is pinned
// by its sha256 and size: a stem that changed on R2 fails the build rather
// than shipping unreviewed.
//
// Nothing has to remember to run this. `sync-native-assets.mjs` calls
// `ensureKaraokeExamples()` before it stages the bundle, so the Vite build
// (the PR gate, CI's native builds, a local `cap sync`) fetches on first use
// and verifies every time after that.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** The native-only asset root; served at the app's own `/`. */
export const NATIVE_ONLY_DIR = join(here, '../native-only')

const R2 = 'https://pub-2aafe9bb91454abb998beb378a16d44a.r2.dev/demo'

/**
 * One fetched file.
 *
 * @typedef {object} KaraokeExamplePin
 * @property {string} path Where it lands, relative to `native-only/`, which
 *   is also where the app asks for it.
 * @property {string} url The public object it is fetched from.
 * @property {number} bytes Its size.
 * @property {string} sha256 Its hash, lowercase hex.
 */

/** @type {readonly KaraokeExamplePin[]} */
export const KARAOKE_EXAMPLE_PINS = [
  {
    path: 'karaoke/examples/goodbye-to-spring/vocal.m4a',
    url: `${R2}/goodbye-to-spring/vocal.m4a`,
    bytes: 4525414,
    sha256: 'fbdd34bae5b930f55b568a7c2366b7ae25ca32ac77d5b8b09d1731a2d2087868',
  },
  {
    path: 'karaoke/examples/goodbye-to-spring/instrumental.m4a',
    url: `${R2}/goodbye-to-spring/instrumental.m4a`,
    bytes: 6028697,
    sha256: '8d0a4bd2460045ae5649fd4d7cfb6b3ad56d4ffe5d5176560eb7c29a76358d79',
  },
  {
    path: 'karaoke/examples/josephine/vocal.m4a',
    url: `${R2}/josephine/vocal.m4a`,
    bytes: 4227574,
    sha256: '444b4d50f200ba632af3286cf4f5fceea87f7bc2fe4db5c25d7e1d8cfc98ff85',
  },
  {
    path: 'karaoke/examples/josephine/instrumental.m4a',
    url: `${R2}/josephine/instrumental.m4a`,
    bytes: 4193246,
    sha256: '32ef5ef48336db2c903dd366e2db74db691548a627d9d0c99cf895a012054ab1',
  },
  {
    path: 'karaoke/examples/nothing-in-the-dark/vocal.m4a',
    url: `${R2}/nothing-in-the-dark/vocal.m4a`,
    bytes: 3062058,
    sha256: 'c7ad38aaf5115559bc5f518bea32993c27b5590209d5b47a52adadc4303bb0ed',
  },
  {
    path: 'karaoke/examples/nothing-in-the-dark/instrumental.m4a',
    url: `${R2}/nothing-in-the-dark/instrumental.m4a`,
    bytes: 4654099,
    sha256: '958b77815541947c2571cf72189abbfd7c4879a2e0e0d344d011805cd676fdc1',
  },
]

/** @param {Uint8Array} bytes */
function sha256Of(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Is the file at `path` exactly the pinned one?
 *
 * @param {string} path
 * @param {KaraokeExamplePin} pin
 */
function matches(path, pin) {
  if (!existsSync(path)) return false
  const bytes = readFileSync(path)
  return bytes.byteLength === pin.bytes && sha256Of(bytes) === pin.sha256
}

/**
 * Every pinned file present and exact, fetching whatever is not.
 *
 * A download that does not match its pin is refused before it is written:
 * the temporary file is removed and the build stops, naming the file, the
 * size and the hash it got.
 *
 * @param {object} [options]
 * @param {string} [options.root] The native-only root (tests pass a temp dir).
 * @param {typeof fetch} [options.fetchImpl]
 * @param {readonly KaraokeExamplePin[]} [options.pins]
 * @param {(line: string) => void} [options.log]
 * @returns {Promise<{ fetched: string[], kept: string[] }>}
 */
export async function ensureKaraokeExamples(options = {}) {
  const root = options.root ?? NATIVE_ONLY_DIR
  const fetchImpl = options.fetchImpl ?? fetch
  const pins = options.pins ?? KARAOKE_EXAMPLE_PINS
  const log = options.log ?? (() => undefined)
  /** @type {string[]} */
  const fetched = []
  /** @type {string[]} */
  const kept = []

  for (const pin of pins) {
    const to = join(root, pin.path)
    if (matches(to, pin)) {
      kept.push(pin.path)
      continue
    }
    log(`[karaoke-examples] fetching ${pin.path}`)
    let response
    try {
      response = await fetchImpl(pin.url)
    } catch (error) {
      throw new Error(
        `[karaoke-examples] ${pin.path}: could not reach ${pin.url} (${error instanceof Error ? error.message : String(error)}). The native build ships the example songs and fetches them once; it needs the network the first time.`,
      )
    }
    if (!response.ok) {
      throw new Error(
        `[karaoke-examples] ${pin.path}: ${pin.url} answered ${response.status}.`,
      )
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    const hash = sha256Of(bytes)
    if (bytes.byteLength !== pin.bytes || hash !== pin.sha256) {
      throw new Error(
        `[karaoke-examples] ${pin.path}: got ${bytes.byteLength} bytes with sha256 ${hash}, pinned ${pin.bytes} bytes with sha256 ${pin.sha256}. The object on R2 changed: review it, then update the pin in scripts/fetch-karaoke-examples.mjs.`,
      )
    }
    mkdirSync(dirname(to), { recursive: true })
    const temporary = `${to}.part`
    writeFileSync(temporary, bytes)
    try {
      renameSync(temporary, to)
    } catch (error) {
      rmSync(temporary, { force: true })
      throw error
    }
    fetched.push(pin.path)
  }
  return { fetched, kept }
}

/**
 * Which pinned files are missing or wrong, without touching the network.
 *
 * @param {string} [root]
 * @param {readonly KaraokeExamplePin[]} [pins]
 * @returns {string[]}
 */
export function checkKaraokeExamples(
  root = NATIVE_ONLY_DIR,
  pins = KARAOKE_EXAMPLE_PINS,
) {
  return pins
    .filter((pin) => !matches(join(root, pin.path), pin))
    .map((pin) => pin.path)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--check')) {
    const bad = checkKaraokeExamples()
    if (bad.length > 0) {
      console.error(
        `[karaoke-examples] missing or not the pinned file:\n${bad.map((path) => `  - ${path}`).join('\n')}`,
      )
      process.exitCode = 1
    } else {
      console.log(
        `[karaoke-examples] all ${KARAOKE_EXAMPLE_PINS.length} pinned files present`,
      )
    }
  } else {
    const { fetched, kept } = await ensureKaraokeExamples({
      log: (line) => console.log(line),
    })
    console.log(
      `[karaoke-examples] ${fetched.length} fetched, ${kept.length} already here`,
    )
  }
}
