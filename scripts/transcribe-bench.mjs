#!/usr/bin/env node
// ============================================================
// transcribe-bench — run the app's stem transcription over real files
// ============================================================
//
// Why a browser: the shipping path decodes and resamples with
// `decodeAudioData`, which is a browser filter chain. A Node reimplementation
// would measure a different program, and a transcription bench that does not
// measure the shipped program is worse than none. So this starts the project's
// own Vite dev server, opens tools/transcribe/index.html in Chromium, and calls
// straight into src/.
//
// Usage:
//   node scripts/transcribe-bench.mjs <audio...> [options]
//
//   --truth <file.gp5|.mid>   Score against a tab. Reports precision, recall,
//                             onset error and octave errors.
//   --truth-track <substring> Which track of the tab is the ground truth.
//                             Default: the first whose name or instrument
//                             looks like a bass.
//   --out <dir>               Where to write. Default ~/agent-out/mercurypitch/<date>.
//   --source <yin|swift>      Which detector produces the frames. Default yin.
//                             `swift` runs the SwiftF0 ONNX model at 16 kHz;
//                             everything after the frames is identical, so the
//                             two are directly comparable.
//   --profile key=value,...   Override transcription profile fields.
//   --seconds <n>             Analyse only the first n seconds. Much faster
//                             while iterating on the algorithm.
//   --label <name>            Names the output files. Default: the audio's.
//   --keep-open               Leave the browser up (debugging the harness).
//
// Writes <label>.notes.json, <label>.mid and, with --truth, <label>.report.md.

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, basename, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
// The scoring arithmetic is src/, shared with the Lab's transcription bench so
// a number here and a number on screen cannot disagree.
import { pickReferenceTrack, pitchHistogram, scoreAgainstTruth, WINDOW_SECONDS, } from '../src/lib/transcription/transcription-score.ts'
import { readMidiTruth } from './midi-truth.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 5311

// ------------------------------------------------------------------
// Arguments
// ------------------------------------------------------------------

function parseArgs(argv) {
  const options = {
    audio: [],
    truth: null,
    truthTrack: null,
    out: null,
    source: 'yin',
    profile: {},
    seconds: null,
    label: null,
    keepOpen: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = () => argv[(index += 1)]
    if (arg === '--truth') options.truth = resolve(next())
    else if (arg === '--truth-track') options.truthTrack = next()
    else if (arg === '--out') options.out = resolve(next())
    else if (arg === '--seconds') options.seconds = Number(next())
    else if (arg === '--label') options.label = next()
    else if (arg === '--keep-open') options.keepOpen = true
    else if (arg === '--source') {
      options.source = next()
      if (options.source !== 'yin' && options.source !== 'swift') {
        throw new Error(`--source takes yin or swift, not ${options.source}`)
      }
    } else if (arg === '--profile') {
      for (const pair of next().split(',')) {
        const [key, value] = pair.split('=')
        // Numeric when it reads as a number, text otherwise: the profile holds
        // both, and coercing everything to Number turned every name into NaN.
        const numeric = Number(value)
        options.profile[key.trim()] =
          value.trim() !== '' && Number.isFinite(numeric) ? numeric : value
      }
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option ${arg}`)
    } else options.audio.push(resolve(arg))
  }
  if (options.audio.length === 0) {
    throw new Error('Give at least one audio file to transcribe.')
  }
  return options
}

function defaultOutDir() {
  const today = new Date().toISOString().slice(0, 10)
  return resolve(
    process.env.HOME ?? '.',
    'agent-out/mercurypitch',
    today,
    'transcribe',
  )
}

// ------------------------------------------------------------------
// Dev server
// ------------------------------------------------------------------

/**
 * Vite serves files outside its root through /@fs, but only ones inside
 * `server.fs.allow`. Passing the inputs' own directories keeps 87 MB stems
 * where they are instead of copying them into the project to give them a URL.
 */
async function startDevServer(allowDirs) {
  const { createServer } = await import('vite')
  const server = await createServer({
    root: REPO_ROOT,
    configFile: resolve(REPO_ROOT, 'vite.config.ts'),
    logLevel: 'warn',
    server: {
      port: PORT,
      strictPort: true,
      fs: { allow: [REPO_ROOT, ...allowDirs] },
    },
  })
  await server.listen()
  const url = server.resolvedUrls?.local?.[0] ?? `http://localhost:${PORT}/`
  return { server, url: url.replace(/\/$/, '') }
}

// ------------------------------------------------------------------
// MIDI writing
// ------------------------------------------------------------------

function variableLength(value) {
  const bytes = [value & 0x7f]
  let rest = value >> 7
  while (rest > 0) {
    bytes.unshift((rest & 0x7f) | 0x80)
    rest >>= 7
  }
  return bytes
}

/**
 * A type-0 MIDI file at 480 ticks per quarter and a fixed 120 BPM, so one tick
 * is a known number of milliseconds and the file reads as seconds rather than
 * as a guess at the song's tempo. Guessing a tempo here would put a wrong
 * downbeat into every file the bench produces.
 */
function notesToMidi(notes) {
  const TICKS_PER_QUARTER = 480
  const TICKS_PER_SECOND = (TICKS_PER_QUARTER * 120) / 60
  const events = []
  for (const note of notes) {
    const onTick = Math.round(note.startSeconds * TICKS_PER_SECOND)
    const offTick = Math.max(
      onTick + 1,
      Math.round((note.startSeconds + note.durationSeconds) * TICKS_PER_SECOND),
    )
    const velocity = Math.max(
      32,
      Math.min(127, Math.round((note.confidence ?? 0.8) * 127)),
    )
    events.push({ tick: onTick, data: [0x90, note.midi & 0x7f, velocity] })
    events.push({ tick: offTick, data: [0x80, note.midi & 0x7f, 0] })
  }
  events.sort((left, right) => left.tick - right.tick)

  const track = []
  let lastTick = 0
  // Tempo: 500000 microseconds per quarter is 120 BPM.
  track.push(0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20)
  for (const event of events) {
    track.push(...variableLength(event.tick - lastTick), ...event.data)
    lastTick = event.tick
  }
  track.push(0x00, 0xff, 0x2f, 0x00)

  const header = [
    0x4d,
    0x54,
    0x68,
    0x64,
    0,
    0,
    0,
    6,
    0,
    0,
    0,
    1,
    (TICKS_PER_QUARTER >> 8) & 0xff,
    TICKS_PER_QUARTER & 0xff,
  ]
  const length = track.length
  const trackHeader = [
    0x4d,
    0x54,
    0x72,
    0x6b,
    (length >> 24) & 0xff,
    (length >> 16) & 0xff,
    (length >> 8) & 0xff,
    length & 0xff,
  ]
  return Buffer.from([...header, ...trackHeader, ...track])
}

// ------------------------------------------------------------------
// Scoring against a tab
// ------------------------------------------------------------------

/** `pickReferenceTrack` returns null on a miss; a CLI should say what it had. */
function pickTruthTrack(song, wanted) {
  const found = pickReferenceTrack(song.tracks, wanted)
  if (found !== null) return found
  throw new Error(
    `No track matching "${wanted}". Tracks: ${song.tracks
      .map((track) => `${track.name} (${track.instrumentName})`)
      .join(', ')}`,
  )
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`
}

function buildReport(label, result, profile, scored, heard, truth, truthTrack) {
  const lines = [
    `# Transcription bench — ${label}`,
    '',
    `Audio: ${result.durationSeconds.toFixed(1)} s at ${result.sampleRate} Hz analysis rate.`,
    `Took ${(result.elapsedMs / 1000).toFixed(1)} s.`,
    '',
    '## Profile',
    '',
    '```json',
    JSON.stringify(profile, null, 2),
    '```',
    '',
    '## What was heard',
    '',
    `- Notes: **${result.notes.length}**`,
    `- Frame coverage: **${pct(result.coverage)}** of analysed frames gave a confident pitch`,
    `- Most common pitches: ${pitchHistogram(result.notes)
      .map(([midi, count]) => `${midi}×${count}`)
      .join(', ')}`,
  ]

  if (scored !== null) {
    lines.push(
      '',
      '## Against the tab',
      '',
      `Ground truth: **${truthTrack.name}** (${truthTrack.instrumentName}), ${truth.length} notes.`,
      `Aligned in ${WINDOW_SECONDS} s windows; local offsets spread over ${scored.windowOffsetSpread.toFixed(2)} s.`,
      '',
      '| Measure | Value |',
      '| --- | --- |',
      `| Heard notes | ${scored.heardCount} |`,
      `| Tab notes | ${scored.truthCount} |`,
      `| Exact pitch match | ${scored.exact} (${pct(scored.precision)} of heard) |`,
      `| Right note, any octave | ${scored.exact + scored.octaveOff} (${pct(scored.octaveTolerantPrecision)} of heard) |`,
      `| Octave errors | ${scored.octaveOff} |`,
      `| Wrong pitch | ${scored.wrongPitch} |`,
      `| Heard but no tab note near | ${scored.unmatched} |`,
      `| Tab notes never heard | ${scored.missed} |`,
      `| Recall | ${pct(scored.recall)} |`,
      `| Onset error p50 | ${scored.onsetP50Ms === null ? 'n/a' : `${scored.onsetP50Ms.toFixed(0)} ms`} |`,
      `| Onset error p95 | ${scored.onsetP95Ms === null ? 'n/a' : `${scored.onsetP95Ms.toFixed(0)} ms`} |`,
      '',
      `Wrong-pitch errors by interval (semitones, truth minus heard): ${scored.pitchErrors
        .map(([delta, count]) => `${delta > 0 ? '+' : ''}${delta}x${count}`)
        .join(', ')}`,
      '',
      '### Pitch histograms',
      '',
      `Heard: ${pitchHistogram(heard)
        .map(([m, c]) => `${m}×${c}`)
        .join(', ')}`,
      '',
      `Tab:   ${pitchHistogram(truth)
        .map(([m, c]) => `${m}×${c}`)
        .join(', ')}`,
    )
  }
  return `${lines.join('\n')}\n`
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const outDir = options.out ?? defaultOutDir()
  await mkdir(outDir, { recursive: true })

  const allowDirs = [
    ...options.audio.map((file) => dirname(file)),
    ...(options.truth === null ? [] : [dirname(options.truth)]),
  ]
  const { server, url } = await startDevServer(allowDirs)
  const browser = await chromium.launch()
  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  page.on('console', (message) => {
    if (message.type() === 'error') console.error('  [page]', message.text())
  })

  try {
    await page.goto(`${url}/tools/transcribe/index.html`, {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForFunction(() => window.transcribeBench?.ready === true, {
      timeout: 60_000,
    })

    let truthSong = null
    if (options.truth !== null) {
      if (/\.midi?$/i.test(options.truth)) {
        // Read in Node, through the whole tempo map. A tab's own MIDI export is
        // the only truth here that is already in the recording's own time.
        truthSong = await readMidiTruth(options.truth)
        console.log(
          `Tab: ${truthSong.tracks.length} tracks, tempo ${truthSong.tempoChanges
            .map((change) => change.bpm)
            .join(' -> ')}`,
        )
      } else {
        truthSong = await page.evaluate(
          ([fsUrl, name]) => window.transcribeBench.readTab(fsUrl, name),
          [`${url}/@fs${options.truth}`, basename(options.truth)],
        )
        // Beats at one tempo. Fine for a constant-tempo tab and wrong the
        // moment one changes, which is why a .mid truth is preferred.
        const secondsPerBeat = 60 / truthSong.bpm
        for (const track of truthSong.tracks) {
          track.notes = track.notes
            .map((note) => ({
              midi: note.midi,
              startSeconds: note.startBeat * secondsPerBeat,
              durationSeconds: note.duration * secondsPerBeat,
            }))
            .sort((left, right) => left.startSeconds - right.startSeconds)
        }
        console.log(
          `Tab: ${truthSong.tracks.length} tracks at a fixed ${truthSong.bpm} BPM — ` +
            truthSong.tracks
              .map((track) => `${track.name} (${track.noteCount})`)
              .join(', '),
        )
      }
    }

    for (const audioPath of options.audio) {
      const label = options.label ?? basename(audioPath, extname(audioPath))
      console.log(
        `\nTranscribing ${basename(audioPath)} with ${options.source}…`,
      )
      const result = await page.evaluate(
        ([fsUrl, source, profileOverrides]) =>
          window.transcribeBench.transcribe(fsUrl, source, profileOverrides),
        [`${url}/@fs${audioPath}`, options.source, options.profile],
      )

      const notes =
        options.seconds === null
          ? result.notes
          : result.notes.filter((note) => note.startSeconds < options.seconds)

      let scored = null
      let truthNotes = []
      let truthTrack = null
      if (truthSong !== null) {
        truthTrack = pickTruthTrack(truthSong, options.truthTrack)
        truthNotes = truthTrack.notes
        if (options.seconds !== null) {
          truthNotes = truthNotes.filter(
            (note) => note.startSeconds < options.seconds,
          )
        }
        scored = scoreAgainstTruth(notes, truthNotes, 0.12)
      }

      // The profile the harness actually ran, not the overrides asked for: a
      // report that lists only the flags hides every default the run depended
      // on, and the defaults are what changes between sources.
      const profile = result.profile
      await writeFile(
        resolve(outDir, `${label}.notes.json`),
        JSON.stringify({ audio: audioPath, ...result, notes, scored }, null, 2),
      )
      await writeFile(resolve(outDir, `${label}.mid`), notesToMidi(notes))
      const report = buildReport(
        label,
        result,
        profile,
        scored,
        notes,
        truthNotes,
        truthTrack ?? { name: '—', instrumentName: '—' },
      )
      await writeFile(resolve(outDir, `${label}.report.md`), report)
      console.log(report)
    }

    if (options.keepOpen) {
      console.log('Browser left open. Ctrl-C to stop.')
      await new Promise(() => {})
    }
  } finally {
    if (!options.keepOpen) {
      await browser.close()
      await server.close()
    }
  }
  console.log(`Wrote to ${outDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
