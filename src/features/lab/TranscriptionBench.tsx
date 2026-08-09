// ============================================================
// TranscriptionBench — turn a stem into notes, and see where it went wrong
// ============================================================
//
// The deep-dive surface for stem transcription. Load a separated stem, run the
// shipping transcriber over it, and look at every note it found on a roll —
// coloured against a tab, if one is loaded, so the errors are visible rather
// than averaged into a percentage.
//
// It runs `transcribeStem`, the same worker-first entry point the app uses,
// and scores with `transcription-score.ts`, the same arithmetic as
// `node scripts/transcribe-bench.mjs`. Neither is reimplemented here: a bench
// that measures its own copy of the algorithm measures nothing.
//
// Edit mode is `pitch-edit-model.ts`, borrowed from the stem mixer's vocal
// pitch editor. Corrections are pinned and survive a re-run at different
// settings, so the manual pass is not thrown away every time the profile moves.

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import type { MidiSong, MidiSongTrack } from '@/lib/midi-song'
import { createBeatClock, parseMidiSong } from '@/lib/midi-song'
import { downloadMIDI } from '@/lib/piano-roll'
import { midiToNote } from '@/lib/scale-data'
import { installSpacePlaybackToggle } from '@/lib/space-playback'
import { parseGuitarProFile } from '@/lib/tab/gp-import'
import type { StemTranscription, TranscriptionPitchSource, TranscriptionProfile, } from '@/lib/transcription/stem-transcription'
import { BASS_SWIFT_TRANSCRIPTION_PROFILE, BASS_TRANSCRIPTION_PROFILE, } from '@/lib/transcription/stem-transcription'
import { transcribeStem } from '@/lib/transcription/stem-transcription-client'
import type { NoteVerdict, ScorableNote, } from '@/lib/transcription/transcription-score'
import { pickReferenceTrack, scoreAgainstTruth, WINDOW_SECONDS, } from '@/lib/transcription/transcription-score'
import type { MelodyItem } from '@/types'
import type { EditableNote, PitchEditLayer, } from '../stem-mixer/pitch-edit-model'
import { applyEditLayer, deleteNote, editNote, emptyEditLayer, splitNote, } from '../stem-mixer/pitch-edit-model'
import labStyles from './Lab.module.css'
import type { RollHit, RollNote, RollViewport } from './transcription-roll'
import { fitViewport, hitTest, midiToY, noteRect, panViewport, rowHeight, secondsToX, visibleNotes, xToSeconds, yToMidi, zoomViewport, } from './transcription-roll'
import styles from './TranscriptionBench.module.css'

/** How close a heard onset has to be to count as the same note. */
const MATCH_TOLERANCE_SECONDS = 0.12

/**
 * The roll measures time in seconds; the edit model names its axis in beats
 * because the stem mixer measures time in beats. The model never converts —
 * it only compares and orders — so seconds pass through unchanged. The field
 * names below are the model's, not a claim about this tool's timebase.
 */
const toEditable = (
  note: StemTranscription['notes'][number],
  index: number,
): EditableNote => ({
  id: `base-${index}`,
  startBeat: note.startSeconds,
  endBeat: note.startSeconds + note.durationSeconds,
  midi: note.midi,
})

const VERDICT_COLORS: Record<NoteVerdict, string> = {
  exact: '#3fb950',
  octave: '#d29922',
  'wrong-pitch': '#f85149',
  // A shadow is probably a RIGHT note whose neighbour went unheard, so it
  // must not read as red — the note is not the defect, the gap next to it is.
  shadow: '#a371f7',
  spurious: '#6e7681',
}

const noteName = (midi: number): string => {
  const { name, octave } = midiToNote(midi)
  return `${name}${octave}`
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.0'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${(seconds % 60).toFixed(1).padStart(4, '0')}`
}

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`

type RunStatus = 'idle' | 'running' | 'done' | 'error'

export const TranscriptionBench: Component = () => {
  const [stem, setStem] = createSignal<File | null>(null)
  const [reference, setReference] = createSignal<MidiSong | null>(null)
  const [referenceName, setReferenceName] = createSignal('')
  const [trackId, setTrackId] = createSignal('')
  const [source, setSource] = createSignal<TranscriptionPitchSource>('yin')
  const [confidence, setConfidence] = createSignal<number | null>(null)

  const [status, setStatus] = createSignal<RunStatus>('idle')
  const [progress, setProgress] = createSignal(0)
  const [message, setMessage] = createSignal<string | null>(null)
  const [result, setResult] = createSignal<StemTranscription | null>(null)
  const [elapsedMs, setElapsedMs] = createSignal(0)

  const [editing, setEditing] = createSignal(false)
  const [layer, setLayer] = createSignal<PitchEditLayer>(emptyEditLayer())
  const [history, setHistory] = createSignal<PitchEditLayer[]>([])
  const [selected, setSelected] = createSignal<string | null>(null)

  const [viewport, setViewport] = createSignal<RollViewport | null>(null)
  // When the tab is aligned, its outlines are drawn on the recording's clock
  // using the scorer's own per-window offsets. Raw stays available because
  // the drift itself is sometimes the thing being inspected.
  const [alignTab, setAlignTab] = createSignal(true)
  const [playing, setPlaying] = createSignal<'heard' | 'tab' | null>(null)
  const [playhead, setPlayhead] = createSignal(0)
  let canvas!: HTMLCanvasElement
  let abort: AbortController | null = null

  onCleanup(() => abort?.abort())

  // ── Profile ──────────────────────────────────────────────────

  const profile = createMemo<TranscriptionProfile>(() => {
    const base =
      source() === 'swift'
        ? BASS_SWIFT_TRANSCRIPTION_PROFILE
        : BASS_TRANSCRIPTION_PROFILE
    const override = confidence()
    return override === null ? base : { ...base, minConfidence: override }
  })

  // Each source has its own tuned floor, so the slider follows the source
  // rather than carrying one source's number onto the other.
  createEffect(() => {
    source()
    setConfidence(null)
  })

  // ── Notes ────────────────────────────────────────────────────

  const baseNotes = createMemo<EditableNote[]>(() => {
    const transcription = result()
    return transcription === null ? [] : transcription.notes.map(toEditable)
  })

  const notes = createMemo<EditableNote[]>(() =>
    applyEditLayer(baseNotes(), layer()),
  )

  const rollNotes = createMemo<RollNote[]>(() =>
    notes().map((note) => ({
      id: note.id,
      startSeconds: note.startBeat,
      endSeconds: note.endBeat,
      midi: note.midi,
    })),
  )

  const referenceTrack = createMemo<MidiSongTrack | null>(() => {
    const song = reference()
    if (song === null) return null
    return (
      song.tracks.find((track) => track.id === trackId()) ??
      pickReferenceTrack(song.tracks) ??
      null
    )
  })

  /** Reference notes in real seconds, through the file's whole tempo map. */
  const referenceNotes = createMemo<RollNote[]>(() => {
    const song = reference()
    const track = referenceTrack()
    if (song === null || track === null) return []
    const clock = createBeatClock(song)
    return track.notes.map((note, index) => ({
      id: `ref-${index}`,
      startSeconds: clock(note.startBeat),
      endSeconds: clock(note.startBeat + note.duration),
      midi: note.midi,
    }))
  })

  const scorable = (list: readonly RollNote[]): ScorableNote[] =>
    list.map((note) => ({ midi: note.midi, startSeconds: note.startSeconds }))

  const score = createMemo(() => {
    const heard = rollNotes()
    const truth = referenceNotes()
    if (heard.length === 0 || truth.length === 0) return null
    return scoreAgainstTruth(
      scorable(heard),
      scorable(truth),
      MATCH_TOLERANCE_SECONDS,
    )
  })

  /** Verdict per note id, so the roll can colour what the numbers summarise. */
  const verdicts = createMemo<Map<string, NoteVerdict>>(() => {
    const scored = score()
    const list = rollNotes()
    const map = new Map<string, NoteVerdict>()
    if (scored === null) return map
    for (const entry of scored.notes) {
      const note = list[entry.index]
      if (note !== undefined) map.set(note.id, entry.verdict)
    }
    return map
  })

  /** Tab outlines moved onto the recording's clock, window by window. */
  const alignedReferenceNotes = createMemo<RollNote[]>(() => {
    const refs = referenceNotes()
    const scored = score()
    if (!alignTab() || scored === null || scored.windowOffsets.length === 0) {
      return refs
    }
    const offsets = scored.windowOffsets
    const offsetAt = (seconds: number): number => {
      let inForce = offsets[0]?.offsetSeconds ?? 0
      for (const entry of offsets) {
        if (entry.startSeconds <= seconds) inForce = entry.offsetSeconds
        else break
      }
      return inForce
    }
    return refs.map((note) => {
      // Offsets are keyed by heard-window start, so look up where the note
      // LANDS: shift once to get near the audio clock, then read the offset
      // that actually governs that neighbourhood.
      const rough = note.startSeconds - offsetAt(note.startSeconds)
      const offset = offsetAt(Math.max(0, rough))
      return {
        ...note,
        startSeconds: note.startSeconds - offset,
        endSeconds: note.endSeconds - offset,
      }
    })
  })

  const totalSeconds = createMemo(() => {
    const analysed = result()?.analysedSeconds ?? 0
    const lastReference = alignedReferenceNotes().at(-1)?.endSeconds ?? 0
    return Math.max(1, analysed, lastReference)
  })

  // ── Playback ─────────────────────────────────────────────────

  let audio: AudioContext | null = null
  let scheduleTimer: number | undefined
  let playheadFrame = 0

  const stopPlayback = (): void => {
    if (scheduleTimer !== undefined) window.clearInterval(scheduleTimer)
    scheduleTimer = undefined
    cancelAnimationFrame(playheadFrame)
    setPlaying(null)
    const context = audio
    audio = null
    void context?.close()
  }

  /**
   * Audition a note list from the playhead. Plain oscillators on purpose:
   * the question this answers is "what pitches, when", and a synth patch
   * flattering the notes would get in the way of hearing a wrong one.
   */
  const startPlayback = (source: 'heard' | 'tab'): void => {
    stopPlayback()
    const list = (source === 'heard' ? rollNotes() : alignedReferenceNotes())
      .filter((note) => note.endSeconds > playhead())
      .sort((left, right) => left.startSeconds - right.startSeconds)
    if (list.length === 0) return

    const context = new AudioContext()
    audio = context
    const master = context.createGain()
    master.gain.value = 0.5
    master.connect(context.destination)
    const origin = context.currentTime + 0.08
    const from = playhead()
    let next = 0

    // Chunked lookahead: scheduling seventeen hundred oscillators up front
    // would stall the thread; a second's worth at a time never does.
    const scheduleAhead = (): void => {
      if (audio !== context) return
      const horizon = from + (context.currentTime - origin) + 1.2
      while (next < list.length) {
        const note = list[next]
        if (note === undefined || note.startSeconds > horizon) break
        next += 1
        const at = origin + (note.startSeconds - from)
        if (at < context.currentTime) continue
        const duration = Math.max(0.06, note.endSeconds - note.startSeconds)
        const osc = context.createOscillator()
        const gain = context.createGain()
        // Two sources, two timbres, so switching between them is audible
        // even before the pitches differ.
        osc.type = source === 'heard' ? 'sawtooth' : 'triangle'
        osc.frequency.value = 440 * Math.pow(2, (note.midi - 69) / 12)
        gain.gain.setValueAtTime(0, at)
        gain.gain.linearRampToValueAtTime(0.22, at + 0.008)
        gain.gain.setTargetAtTime(0, at + duration - 0.03, 0.02)
        osc.connect(gain)
        gain.connect(master)
        osc.start(at)
        osc.stop(at + duration + 0.2)
      }
    }
    scheduleAhead()
    scheduleTimer = window.setInterval(scheduleAhead, 250)

    const end = list.at(-1)?.endSeconds ?? from
    const tick = (): void => {
      if (audio !== context) return
      const at = from + Math.max(0, context.currentTime - origin)
      setPlayhead(at)
      if (at >= end + 0.2) {
        stopPlayback()
        return
      }
      playheadFrame = requestAnimationFrame(tick)
    }
    setPlaying(source)
    playheadFrame = requestAnimationFrame(tick)
  }

  const togglePlayback = (source: 'heard' | 'tab'): void => {
    if (playing() === source) stopPlayback()
    else startPlayback(source)
  }

  onCleanup(stopPlayback)

  onMount(() => {
    onCleanup(
      installSpacePlaybackToggle({
        toggle: () => {
          if (playing() !== null) {
            stopPlayback()
            return
          }
          if (notes().length > 0) startPlayback('heard')
          else if (alignedReferenceNotes().length > 0) startPlayback('tab')
        },
        enabled: () => notes().length > 0 || alignedReferenceNotes().length > 0,
      }),
    )
  })

  // ── Running ──────────────────────────────────────────────────

  const run = async (): Promise<void> => {
    const file = stem()
    if (file === null) return
    abort?.abort()
    const controller = new AbortController()
    abort = controller

    setStatus('running')
    setProgress(0)
    setMessage(null)
    const url = URL.createObjectURL(file)
    const startedAt = performance.now()
    try {
      const transcription = await transcribeStem(url, {
        profile: profile(),
        signal: controller.signal,
        onProgress: setProgress,
      })
      setElapsedMs(Math.round(performance.now() - startedAt))
      setResult(transcription)
      setStatus('done')
      // A re-run replaces the base notes but keeps the edit layer: manual
      // corrections are the expensive part and they survive by design.
      setViewport(null)
    } catch (error) {
      if (controller.signal.aborted) return
      setStatus('error')
      setMessage(
        error instanceof Error ? error.message : 'That stem could not be read.',
      )
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const readReference = async (file: File): Promise<void> => {
    setMessage(null)
    try {
      let song: MidiSong | null
      if (/\.midi?$/i.test(file.name)) {
        song = parseMidiSong(new Uint8Array(await file.arrayBuffer()))
      } else {
        song = (await parseGuitarProFile(file)).song
      }
      if (song === null) {
        setMessage(`${file.name} is not a tab this can read.`)
        return
      }
      setReference(song)
      setReferenceName(file.name)
      setTrackId(pickReferenceTrack(song.tracks)?.id ?? '')
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'That tab could not be read.',
      )
    }
  }

  // ── Editing ──────────────────────────────────────────────────

  const commit = (next: PitchEditLayer): void => {
    setHistory((stack) => [...stack.slice(-49), layer()])
    setLayer(next)
  }

  const undo = (): void => {
    const stack = history()
    const previous = stack.at(-1)
    if (previous === undefined) return
    setHistory(stack.slice(0, -1))
    setLayer(previous)
  }

  const selectedNote = createMemo<EditableNote | null>(() => {
    const id = selected()
    return id === null ? null : (notes().find((n) => n.id === id) ?? null)
  })

  const removeSelected = (): void => {
    const note = selectedNote()
    if (note === null) return
    commit(deleteNote(layer(), note))
    setSelected(null)
  }

  const retuneSelected = (semitones: number): void => {
    const note = selectedNote()
    if (note === null) return
    const next = editNote(layer(), note, { midi: note.midi + semitones })
    commit(next)
    // The edit pins a new manual note, so the selection has to follow it.
    setSelected(next.manual.at(-1)?.id ?? null)
  }

  const splitSelected = (): void => {
    const note = selectedNote()
    if (note === null) return
    commit(splitNote(layer(), note, (note.startBeat + note.endBeat) / 2))
    setSelected(null)
  }

  // ── Roll interaction ─────────────────────────────────────────

  interface Drag {
    hit: RollHit
    startSeconds: number
    startMidi: number
  }
  let drag: Drag | null = null

  const localPoint = (event: PointerEvent): { x: number; y: number } => {
    const box = canvas.getBoundingClientRect()
    return { x: event.clientX - box.left, y: event.clientY - box.top }
  }

  const onPointerDown = (event: PointerEvent): void => {
    const view = viewport()
    if (view === null) return
    const { x, y } = localPoint(event)
    const hit = hitTest(rollNotes(), view, x, y)
    if (hit === null) {
      setSelected(null)
      // Empty space is the scrub surface: the click moves the playhead, and
      // a running audition keeps playing from the new place.
      const wasPlaying = playing()
      if (wasPlaying !== null) stopPlayback()
      setPlayhead(Math.max(0, xToSeconds(x, view)))
      if (wasPlaying !== null) startPlayback(wasPlaying)
      return
    }
    setSelected(hit.note.id)
    if (!editing()) return
    canvas.setPointerCapture(event.pointerId)
    drag = {
      hit,
      startSeconds: xToSeconds(x, view),
      startMidi: yToMidi(y, view),
    }
  }

  const onPointerMove = (event: PointerEvent): void => {
    const view = viewport()
    if (view === null) return
    if (drag === null) {
      const { x, y } = localPoint(event)
      const hover = hitTest(rollNotes(), view, x, y)
      canvas.style.cursor = !editing()
        ? 'default'
        : hover === null
          ? 'crosshair'
          : hover.zone === 'end'
            ? 'ew-resize'
            : 'grab'
    }
  }

  const onPointerUp = (event: PointerEvent): void => {
    const view = viewport()
    const active = drag
    drag = null
    if (active === null || view === null) return
    canvas.releasePointerCapture(event.pointerId)

    const { x, y } = localPoint(event)
    const note = notes().find((entry) => entry.id === active.hit.note.id)
    if (note === undefined) return

    if (active.hit.zone === 'end') {
      const endBeat = xToSeconds(x, view)
      if (endBeat <= note.startBeat) return
      const next = editNote(layer(), note, { endBeat })
      commit(next)
      setSelected(next.manual.at(-1)?.id ?? null)
      return
    }

    const deltaSeconds = xToSeconds(x, view) - active.startSeconds
    const deltaMidi = yToMidi(y, view) - active.startMidi
    if (deltaSeconds === 0 && deltaMidi === 0) return
    const next = editNote(layer(), note, {
      startBeat: note.startBeat + deltaSeconds,
      endBeat: note.endBeat + deltaSeconds,
      midi: note.midi + deltaMidi,
    })
    commit(next)
    setSelected(next.manual.at(-1)?.id ?? null)
  }

  const onWheel = (event: WheelEvent): void => {
    const view = viewport()
    if (view === null) return
    event.preventDefault()
    const box = canvas.getBoundingClientRect()
    if (event.ctrlKey || event.shiftKey) {
      setViewport(
        zoomViewport(
          view,
          event.deltaY > 0 ? 1.2 : 1 / 1.2,
          event.clientX - box.left,
          totalSeconds(),
        ),
      )
      return
    }
    const span = view.endSeconds - view.startSeconds
    setViewport(panViewport(view, (event.deltaY / 400) * span, totalSeconds()))
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!editing() || selectedNote() === null) return
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      removeSelected()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      retuneSelected(event.shiftKey ? 12 : 1)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      retuneSelected(event.shiftKey ? -12 : -1)
    } else if (event.key.toLowerCase() === 's') {
      event.preventDefault()
      splitSelected()
    }
  }

  // ── Drawing ──────────────────────────────────────────────────

  onMount(() => {
    const resize = (): void => {
      const ratio = window.devicePixelRatio || 1
      const box = canvas.getBoundingClientRect()
      canvas.width = Math.round(box.width * ratio)
      canvas.height = Math.round(box.height * ratio)
      setViewport((current) =>
        current === null
          ? null
          : { ...current, width: box.width, height: box.height },
      )
    }
    resize()
    window.addEventListener('resize', resize)
    onCleanup(() => window.removeEventListener('resize', resize))
  })

  // A null viewport means "frame whatever is loaded now" — set after a run, a
  // reference load, or a resize, rather than fighting the user's own zoom.
  createEffect(() => {
    const heard = rollNotes()
    const truth = alignedReferenceNotes()
    if (viewport() !== null || heard.length + truth.length === 0) return
    const box = canvas.getBoundingClientRect()
    setViewport(fitViewport([...heard, ...truth], box.width, box.height))
  })

  createEffect(() => {
    const view = viewport()
    const context = canvas.getContext('2d')
    if (context === null) return
    const ratio = window.devicePixelRatio || 1
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (view === null) return

    const rows = rowHeight(view)
    const verdictOf = verdicts()
    const selectedId = selected()

    // Rows, with the naturals shaded so the octave is countable by eye.
    for (let midi = view.minMidi; midi <= view.maxMidi; midi += 1) {
      const black = [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12)
      context.fillStyle = black
        ? 'rgba(255, 255, 255, 0.02)'
        : 'rgba(255, 255, 255, 0.05)'
      context.fillRect(0, midiToY(midi, view), view.width, rows)
      if (((midi % 12) + 12) % 12 === 0) {
        context.fillStyle = 'rgba(255, 255, 255, 0.18)'
        context.fillRect(0, midiToY(midi, view), view.width, 1)
      }
    }

    // Seconds, at whatever spacing keeps the labels apart at this zoom.
    const span = view.endSeconds - view.startSeconds
    const step = span > 120 ? 30 : span > 40 ? 10 : span > 8 ? 2 : 0.5
    context.fillStyle = 'rgba(255, 255, 255, 0.35)'
    context.font = '10px system-ui, sans-serif'
    for (
      let at = Math.ceil(view.startSeconds / step) * step;
      at <= view.endSeconds;
      at += step
    ) {
      const x = secondsToX(at, view)
      context.fillRect(x, 0, 1, view.height)
      context.fillText(formatTime(at), x + 3, 11)
    }

    // The tab underneath, as outlines — it is the thing being compared to, not
    // a result, and a filled block would read as another transcription.
    context.strokeStyle = 'rgba(88, 166, 255, 0.85)'
    context.lineWidth = 1
    for (const note of visibleNotes(alignedReferenceNotes(), view)) {
      const rect = noteRect(note, view)
      context.strokeRect(
        rect.x + 0.5,
        rect.y + 1.5,
        rect.width,
        rect.height - 3,
      )
    }

    for (const note of visibleNotes(rollNotes(), view)) {
      const rect = noteRect(note, view)
      const verdict = verdictOf.get(note.id)
      context.fillStyle =
        verdict === undefined ? '#8b949e' : VERDICT_COLORS[verdict]
      context.globalAlpha = note.id === selectedId ? 1 : 0.85
      context.fillRect(rect.x, rect.y + 1, rect.width, rect.height - 2)
      if (note.id === selectedId) {
        context.globalAlpha = 1
        context.strokeStyle = '#ffffff'
        context.lineWidth = 2
        context.strokeRect(rect.x - 1, rect.y, rect.width + 2, rect.height)
      }
      context.globalAlpha = 1
    }

    // The playhead, over everything: it is where the ear currently is.
    const headX = secondsToX(playhead(), view)
    if (headX >= 0 && headX <= view.width) {
      context.fillStyle = '#58a6ff'
      context.fillRect(headX - 1, 0, 2, view.height)
    }
  })

  // ── Export ───────────────────────────────────────────────────

  const exportMidi = (): void => {
    // 60 BPM makes one beat exactly one second, so the seconds this tool
    // measures survive the export without a tempo being invented for them.
    const melody: MelodyItem[] = notes().map((note, index) => {
      const { name, octave } = midiToNote(note.midi)
      return {
        id: index,
        note: {
          midi: note.midi,
          name,
          octave,
          freq: 440 * Math.pow(2, (note.midi - 69) / 12),
        },
        startBeat: note.startBeat,
        duration: Math.max(0.05, note.endBeat - note.startBeat),
      }
    })
    downloadMIDI(melody, 60, `${stem()?.name ?? 'stem'}.transcribed.mid`)
  }

  const exportJson = (): void => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            stem: stem()?.name ?? null,
            profile: profile(),
            elapsedMs: elapsedMs(),
            coverage: result()?.coverage ?? 0,
            reference: referenceTrack()?.name ?? null,
            score: score(),
            notes: notes().map((note) => ({
              midi: note.midi,
              noteName: noteName(note.midi),
              startSeconds: note.startBeat,
              durationSeconds: note.endBeat - note.startBeat,
              edited: !note.id.startsWith('base-'),
            })),
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${stem()?.name ?? 'stem'}.notes.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div class={styles.bench}>
      <p class={labStyles.hint}>
        Runs the shipping transcriber over a separated stem and scores it
        against a tab, with the same arithmetic as{' '}
        <code>node scripts/transcribe-bench.mjs</code>. Files stay on this
        device — nothing is uploaded.
      </p>

      <div class={styles.sources}>
        <label class={styles.slot}>
          <span class={styles.slotLabel}>Stem</span>
          <span class={styles.slotHint}>
            One separated instrument. Bass is what the profiles are tuned for.
          </span>
          <input
            accept="audio/*"
            type="file"
            onChange={(event) =>
              setStem(event.currentTarget.files?.[0] ?? null)
            }
          />
        </label>

        <label class={styles.slot}>
          <span class={styles.slotLabel}>Reference tab</span>
          <span class={styles.slotHint}>
            Optional. MIDI or Guitar Pro — read through its whole tempo map.
          </span>
          <input
            accept=".mid,.midi,.gp,.gp3,.gp4,.gp5,.gpx"
            type="file"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file !== undefined) void readReference(file)
            }}
          />
        </label>

        <Show when={reference()}>
          {(song) => (
            <label class={styles.slot}>
              <span class={styles.slotLabel}>Reference track</span>
              <span class={styles.slotHint}>{referenceName()}</span>
              <select
                value={trackId()}
                onChange={(event) => setTrackId(event.currentTarget.value)}
              >
                <For each={song().tracks}>
                  {(track) => (
                    <option value={track.id}>
                      {track.name} ({track.noteCount})
                    </option>
                  )}
                </For>
              </select>
            </label>
          )}
        </Show>
      </div>

      <div class={styles.controls}>
        <label class={styles.control}>
          <span>Pitch source</span>
          <select
            value={source()}
            onChange={(event) =>
              setSource(event.currentTarget.value as TranscriptionPitchSource)
            }
          >
            <option value="yin">YIN (windowed autocorrelation)</option>
            <option value="swift">SwiftF0 (ONNX model)</option>
          </select>
        </label>

        <label class={styles.control}>
          <span>Confidence floor {profile().minConfidence.toFixed(2)}</span>
          <input
            max="0.99"
            min="0.05"
            step="0.01"
            type="range"
            value={profile().minConfidence}
            onInput={(event) =>
              setConfidence(Number(event.currentTarget.value))
            }
          />
        </label>

        <button
          class={styles.run}
          disabled={stem() === null || status() === 'running'}
          type="button"
          onClick={() => void run()}
        >
          {status() === 'running' ? 'Transcribing…' : 'Transcribe'}
        </button>
      </div>

      <Show when={status() === 'running'}>
        <div class={styles.progressRow}>
          <progress class={styles.progress} max="1" value={progress()} />
          <span class={styles.progressLabel}>
            {Math.round(progress() * 100)}%
          </span>
        </div>
      </Show>

      <Show when={message()}>
        {(text) => (
          <p class={styles.error} role="alert">
            {text()}
          </p>
        )}
      </Show>

      <Show when={result()}>
        {(transcription) => (
          <>
            <dl class={styles.summary}>
              <div>
                <dt>Notes</dt>
                <dd>{notes().length}</dd>
              </div>
              <div>
                <dt>Frame coverage</dt>
                <dd>{pct(transcription().coverage)}</dd>
              </div>
              <div>
                <dt>Analysed</dt>
                <dd>{formatTime(transcription().analysedSeconds)}</dd>
              </div>
              <div>
                <dt>Took</dt>
                <dd>{(elapsedMs() / 1000).toFixed(1)} s</dd>
              </div>
            </dl>

            <Show when={score()}>
              {(scored) => (
                <>
                  <dl class={styles.summary}>
                    <div>
                      <dt>Exact pitch</dt>
                      <dd>
                        {scored().exact} ({pct(scored().precision)})
                      </dd>
                    </div>
                    <div>
                      <dt>Octave errors</dt>
                      <dd>{scored().octaveOff}</dd>
                    </div>
                    <div>
                      <dt>Wrong pitch</dt>
                      <dd>{scored().wrongPitch}</dd>
                    </div>
                    <div>
                      <dt>Shadow of a miss</dt>
                      <dd>{scored().shadowed}</dd>
                    </div>
                    <div>
                      <dt>No tab note near</dt>
                      <dd>{scored().unmatched}</dd>
                    </div>
                    <div>
                      <dt>Never heard</dt>
                      <dd>{scored().missed}</dd>
                    </div>
                    <div>
                      <dt>Recall</dt>
                      <dd>{pct(scored().recall)}</dd>
                    </div>
                    <div>
                      <dt>Onset p50</dt>
                      <dd>
                        {scored().onsetP50Ms === null
                          ? 'n/a'
                          : `${scored().onsetP50Ms?.toFixed(0)} ms`}
                      </dd>
                    </div>
                  </dl>
                  <p class={labStyles.hint}>
                    Aligned in {WINDOW_SECONDS} s windows, because a tab and a
                    recording of it do not share a clock. Local offsets here
                    spread over {scored().windowOffsetSpread.toFixed(2)} s.
                    Commonest wrong intervals (tab minus heard):{' '}
                    {scored()
                      .pitchErrors.map(
                        ([delta, count]) =>
                          `${delta > 0 ? '+' : ''}${delta}×${count}`,
                      )
                      .join(', ') || 'none'}
                    .
                  </p>
                </>
              )}
            </Show>
          </>
        )}
      </Show>

      <div class={styles.rollTools}>
        <button
          type="button"
          aria-pressed={editing()}
          classList={{ [styles.toolActive]: editing() }}
          onClick={() => setEditing((on) => !on)}
        >
          {editing() ? 'Editing' : 'Edit mode'}
        </button>
        <button type="button" disabled={history().length === 0} onClick={undo}>
          Undo
        </button>
        <button
          type="button"
          disabled={selectedNote() === null || !editing()}
          onClick={splitSelected}
        >
          Split
        </button>
        <button
          type="button"
          disabled={selectedNote() === null || !editing()}
          onClick={removeSelected}
        >
          Delete
        </button>
        <button
          type="button"
          disabled={result() === null}
          onClick={() => setViewport(null)}
        >
          Fit
        </button>
        <button
          type="button"
          disabled={notes().length === 0}
          aria-pressed={playing() === 'heard'}
          classList={{ [styles.toolActive]: playing() === 'heard' }}
          onClick={() => togglePlayback('heard')}
        >
          {playing() === 'heard' ? 'Stop' : 'Play heard'}
        </button>
        <button
          type="button"
          disabled={alignedReferenceNotes().length === 0}
          aria-pressed={playing() === 'tab'}
          classList={{ [styles.toolActive]: playing() === 'tab' }}
          onClick={() => togglePlayback('tab')}
        >
          {playing() === 'tab' ? 'Stop' : 'Play tab'}
        </button>
        <button
          type="button"
          disabled={score() === null}
          aria-pressed={alignTab()}
          classList={{ [styles.toolActive]: alignTab() }}
          onClick={() => setAlignTab((on) => !on)}
        >
          {alignTab() ? 'Tab aligned' : 'Tab raw'}
        </button>
        <span class={styles.spacer} />
        <button type="button" disabled={result() === null} onClick={exportMidi}>
          Export MIDI
        </button>
        <button type="button" disabled={result() === null} onClick={exportJson}>
          Export JSON
        </button>
      </div>

      <div class={styles.rollFrame}>
        <canvas
          ref={canvas}
          class={styles.roll}
          tabindex="0"
          aria-label="Transcribed notes"
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
        />
      </div>

      <div class={styles.legend}>
        <span>
          <i
            class={styles.swatch}
            style={{ background: VERDICT_COLORS.exact }}
          />
          Exact
        </span>
        <span>
          <i
            class={styles.swatch}
            style={{ background: VERDICT_COLORS.octave }}
          />
          Octave off
        </span>
        <span>
          <i
            class={styles.swatch}
            style={{ background: VERDICT_COLORS['wrong-pitch'] }}
          />
          Wrong pitch
        </span>
        <span>
          <i
            class={styles.swatch}
            style={{ background: VERDICT_COLORS.shadow }}
          />
          Shadow of a miss
        </span>
        <span>
          <i
            class={styles.swatch}
            style={{ background: VERDICT_COLORS.spurious }}
          />
          No tab note near
        </span>
        <span>
          <i class={styles.swatchOutline} />
          Tab
        </span>
      </div>

      <Show when={selectedNote()}>
        {(note) => (
          <p class={labStyles.hint}>
            Selected: <strong>{noteName(note().midi)}</strong> at{' '}
            {formatTime(note().startBeat)}, lasting{' '}
            {(note().endBeat - note().startBeat).toFixed(2)} s.{' '}
            {editing()
              ? 'Drag to move, drag the right edge to resize, arrows retune (shift for an octave), S splits, Delete removes.'
              : 'Turn on edit mode to change it.'}
          </p>
        )}
      </Show>

      <p class={labStyles.hint}>
        Scroll to pan, ctrl or shift and scroll to zoom. Click empty space to
        move the playhead; Space plays and stops. A shadow note is probably
        RIGHT — the tab holds its pitch just next door, and the real defect is
        the neighbour that went unheard. Edits are pinned and survive a re-run
        at different settings, so a manual pass is not lost every time the
        profile moves.
      </p>
    </div>
  )
}
