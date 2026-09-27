// ============================================================
// The example songs' notes: generated once, on a desktop, committed
// ============================================================
//
//   node scripts/generate-karaoke-example-notes.mjs
//
// A phone cannot analyse a streamed vocal (audit K1): the offline analysis
// decodes the whole stem, and the Karaoke room streams. So the example songs
// carry their notes, computed here by the pipeline the mixer runs
// (`analyzeVocalSamples` at VOCAL_ANALYSIS_DEFAULTS, then the key regions,
// as useStemMixerPitchAnalysisController.runAnalysis does), from the pinned
// stems the bundle ships, and written beside them as notes.json. The native
// seed stores each under its song's session id, where the mixer's
// `loadCachedAnalysis` finds it (src/features/karaoke-night/bundled-notes.ts).
//
// Decoding is ffmpeg's, to 48 kHz float, channel 0: what the mixer analyses
// (`buffer.getChannelData(0)` of a stem a 48 kHz AudioContext decoded). Each
// file records the sha256 of the vocal it came from, and a test fails when a
// stem's pin changes and its notes were not generated again.
//
// Needs ffmpeg on the PATH and the stems present (any native build fetches
// them; so does `node scripts/fetch-karaoke-examples.mjs`). It binds no port:
// Vite runs in middleware mode only to load the TypeScript pipeline.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { checkKaraokeExamples, KARAOKE_EXAMPLE_PINS, NATIVE_ONLY_DIR, } from './fetch-karaoke-examples.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const REPO = join(here, '../../..')

/** The rate the mixer's AudioContext decodes at, on a phone and a desktop. */
export const NOTES_SAMPLE_RATE = 48_000

/** Where a song's notes live: beside its vocal. */
export function notesPathFor(vocalUrl) {
  return join(dirname(vocalUrl.replace(/^\//u, '')), 'notes.json')
}

/** Channel 0 of `path`, as 32-bit floats at NOTES_SAMPLE_RATE. */
function decodeChannel0(path) {
  const out = execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      path,
      '-af',
      'pan=mono|c0=c0',
      '-ar',
      String(NOTES_SAMPLE_RATE),
      '-f',
      'f32le',
      '-',
    ],
    { maxBuffer: 1 << 30 },
  )
  // A Buffer can sit at any offset of a shared pool; a Float32Array cannot.
  return new Float32Array(
    out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength),
  )
}

async function main() {
  const missing = checkKaraokeExamples()
  if (missing.length > 0) {
    throw new Error(
      `[example-notes] the stems are not all here: ${missing.join(', ')}. Run node scripts/fetch-karaoke-examples.mjs first.`,
    )
  }

  const server = await createServer({
    configFile: false,
    root: REPO,
    logLevel: 'error',
    appType: 'custom',
    resolve: { alias: { '@': join(REPO, 'src') } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  })

  try {
    const pipeline = await server.ssrLoadModule(
      '/src/lib/pitch-pipeline/analyze-vocal.ts',
    )
    const keys = await server.ssrLoadModule('/src/lib/key-detection/index.ts')
    const manifest = JSON.parse(
      readFileSync(
        join(NATIVE_ONLY_DIR, 'karaoke/examples/manifest.json'),
        'utf8',
      ),
    )

    for (const song of manifest.songs) {
      const vocal = song.stems.vocal.replace(/^\//u, '')
      const pin = KARAOKE_EXAMPLE_PINS.find(
        (candidate) => candidate.path === vocal,
      )
      if (pin === undefined)
        throw new Error(`[example-notes] no pin for ${vocal}`)

      const samples = decodeChannel0(join(NATIVE_ONLY_DIR, vocal))
      const { algo, mergedNotes, segmentedNotes } =
        await pipeline.analyzeVocalSamples(
          samples,
          NOTES_SAMPLE_RATE,
          pipeline.VOCAL_ANALYSIS_DEFAULTS,
        )
      const keyRegions =
        segmentedNotes.length > 0 ? keys.detectRegionalKeys(segmentedNotes) : []
      const global =
        segmentedNotes.length > 0
          ? keys.detectKeyFromNotes(segmentedNotes)
          : null

      const record = {
        version: 1,
        vocalSha256: pin.sha256,
        sampleRate: NOTES_SAMPLE_RATE,
        algorithm: algo,
        mergedNotes,
        segmentedNotes,
        keyRegions,
      }
      const to = join(NATIVE_ONLY_DIR, notesPathFor(song.stems.vocal))
      const text = `${JSON.stringify(record)}\n`
      writeFileSync(to, text)
      console.log(
        `[example-notes] ${song.slug}: ${algo}, ${mergedNotes.length} merged, ${segmentedNotes.length} cleaned, ${keyRegions.length} key regions, key ${global?.keyName ?? '?'} ${global?.scaleType ?? ''} -> ${to} (${Buffer.byteLength(text)} bytes)`,
      )
    }
  } finally {
    await server.close()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
