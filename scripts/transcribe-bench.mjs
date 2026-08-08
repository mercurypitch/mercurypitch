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
    else if (arg === '--profile') {
      for (const pair of next().split(',')) {
        const [key, value] = pair.split('=')
        options.profile[key.trim()] = Number(value)
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
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1,
    (TICKS_PER_QUARTER >> 8) & 0xff, TICKS_PER_QUARTER & 0xff,
  ]
  const length = track.length
  const trackHeader = [
    0x4d, 0x54, 0x72, 0x6b,
    (length >> 24) & 0xff, (length >> 16) & 0xff,
    (length >> 8) & 0xff, length & 0xff,
  ]
  return Buffer.from([...header, ...trackHeader, ...track])
}

// ------------------------------------------------------------------
// Scoring against a tab
// ------------------------------------------------------------------

const BASS_HINTS = /bass|b\.|bajo|basse/i

function pickTruthTrack(song, wanted) {
  if (wanted !== null) {
    const found = song.tracks.find((track) =>
      `${track.name} ${track.instrumentName}`
        .toLowerCase()
        .includes(wanted.toLowerCase()),
    )
    if (found !== undefined) return found
    throw new Error(
      `No track matching "${wanted}". Tracks: ${song.tracks
        .map((track) => `${track.name} (${track.instrumentName})`)
        .join(', ')}`,
    )
  }
  const byName = song.tracks.find((track) =>
    BASS_HINTS.test(`${track.name} ${track.instrumentName}`),
  )
  return byName ?? song.tracks[0]
}

function median(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

/**
 * Align in windows, not once for the whole song.
 *
 * A tab and a recording of it do not share a clock. Dance of Death's own MIDI
 * export runs 528 s against a 517 s recording — about two percent long, which
 * is eleven seconds of drift by the end. One constant offset cannot fit that,
 * and forcing one does not degrade gracefully: it lands on whatever offset
 * happens to match most, which can be tens of seconds from the truth and makes
 * every number downstream fiction. Windows sidestep the whole question, and a
 * bench does not need a global fit to answer "how did we do around here".
 *
 * Candidate offsets are scored on pitch-class agreement rather than exact
 * pitch, so that an octave error — the thing being measured — cannot drag the
 * alignment off and hide itself.
 */
const WINDOW_SECONDS = 6
const MAX_LOCAL_DRIFT_SECONDS = 6

function bestWindowOffset(heard, truth, toleranceSeconds) {
  const candidates = new Set([0])
  for (const heardNote of heard) {
    for (const truthNote of truth) {
      const delta = truthNote.startSeconds - heardNote.startSeconds
      if (Math.abs(delta) <= MAX_LOCAL_DRIFT_SECONDS) {
        candidates.add(Math.round(delta * 200) / 200)
      }
    }
  }
  let best = { offset: 0, score: -1 }
  for (const offset of candidates) {
    let score = 0
    for (const heardNote of heard) {
      const at = heardNote.startSeconds + offset
      for (const truthNote of truth) {
        if (Math.abs(truthNote.startSeconds - at) > toleranceSeconds) continue
        if ((truthNote.midi - heardNote.midi) % 12 === 0) {
          score += 1
          break
        }
      }
    }
    if (score > best.score) best = { offset, score }
  }
  return best.offset
}

/**
 * Greedy nearest-in-time match inside each window, each truth note used once.
 * Pitch counts as correct only at the exact MIDI number; an octave error gets
 * its own column rather than being folded into "correct", because on a bass
 * line the octave is the part a player notices first.
 */
function scoreAgainstTruth(heardNotes, truthNotes, toleranceSeconds) {
  const onsetErrors = []
  const offsets = []
  const pitchErrors = new Map()
  let exact = 0
  let octaveOff = 0
  let wrongPitch = 0
  let unmatched = 0
  let matchedTruth = 0

  const lastSecond = Math.max(
    heardNotes.at(-1)?.startSeconds ?? 0,
    truthNotes.at(-1)?.startSeconds ?? 0,
  )

  for (let start = 0; start <= lastSecond; start += WINDOW_SECONDS) {
    const end = start + WINDOW_SECONDS
    const heardWindow = heardNotes.filter(
      (note) => note.startSeconds >= start && note.startSeconds < end,
    )
    if (heardWindow.length === 0) continue
    const truthWindow = truthNotes.filter(
      (note) =>
        note.startSeconds >= start - MAX_LOCAL_DRIFT_SECONDS &&
        note.startSeconds < end + MAX_LOCAL_DRIFT_SECONDS,
    )
    if (truthWindow.length === 0) {
      unmatched += heardWindow.length
      continue
    }

    const offset = bestWindowOffset(heardWindow, truthWindow, toleranceSeconds)
    offsets.push(offset)
    const used = new Set()

    for (const heard of heardWindow) {
      const at = heard.startSeconds + offset
      let bestIndex = -1
      let bestGap = Infinity
      for (let index = 0; index < truthWindow.length; index += 1) {
        if (used.has(index)) continue
        const gap = Math.abs(truthWindow[index].startSeconds - at)
        if (gap > toleranceSeconds) continue
        if (gap < bestGap) {
          bestGap = gap
          bestIndex = index
        }
      }
      if (bestIndex === -1) {
        unmatched += 1
        continue
      }
      used.add(bestIndex)
      const truth = truthWindow[bestIndex]
      onsetErrors.push((truth.startSeconds - at) * 1000)
      if (truth.midi === heard.midi) exact += 1
      else if (Math.abs(truth.midi - heard.midi) % 12 === 0) octaveOff += 1
      else {
        wrongPitch += 1
        // What KIND of wrong matters. Errors clustered at a few semitones are
        // the detector hearing a harmonic or a neighbour; errors spread evenly
        // are the matcher pairing notes that have nothing to do with each
        // other, which is a fault in this bench and not in the transcription.
        const delta = truth.midi - heard.midi
        pitchErrors.set(delta, (pitchErrors.get(delta) ?? 0) + 1)
      }
    }
    matchedTruth += used.size
  }

  const absErrors = onsetErrors.map(Math.abs).sort((a, b) => a - b)
  return {
    pitchErrors: [...pitchErrors.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10),
    windowOffsetSpread:
      offsets.length > 1
        ? Math.max(...offsets) - Math.min(...offsets)
        : 0,
    heardCount: heardNotes.length,
    truthCount: truthNotes.length,
    exact,
    octaveOff,
    wrongPitch,
    unmatched,
    missed: truthNotes.length - matchedTruth,
    precision: heardNotes.length > 0 ? exact / heardNotes.length : 0,
    recall: truthNotes.length > 0 ? exact / truthNotes.length : 0,
    octaveTolerantPrecision:
      heardNotes.length > 0 ? (exact + octaveOff) / heardNotes.length : 0,
    onsetMedianMs: median(onsetErrors),
    onsetP50Ms: median(absErrors),
    onsetP95Ms:
      absErrors.length > 0
        ? absErrors[Math.min(absErrors.length - 1, Math.floor(absErrors.length * 0.95))]
        : null,
  }
}

function histogram(notes) {
  const counts = new Map()
  for (const note of notes) counts.set(note.midi, (counts.get(note.midi) ?? 0) + 1)
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
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
    `- Most common pitches: ${histogram(result.notes)
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
      `Heard: ${histogram(heard).map(([m, c]) => `${m}×${c}`).join(', ')}`,
      '',
      `Tab:   ${histogram(truth).map(([m, c]) => `${m}×${c}`).join(', ')}`,
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
      const label =
        options.label ?? basename(audioPath, extname(audioPath))
      console.log(`\nTranscribing ${basename(audioPath)}…`)
      const result = await page.evaluate(
        ([fsUrl, profileOverrides]) =>
          window.transcribeBench.transcribe(fsUrl, profileOverrides),
        [`${url}/@fs${audioPath}`, options.profile],
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

      const profile = { ...options.profile }
      await writeFile(
        resolve(outDir, `${label}.notes.json`),
        JSON.stringify(
          { audio: audioPath, ...result, notes, scored },
          null,
          2,
        ),
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
