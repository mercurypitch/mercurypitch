// ============================================================
// A mapping session over known lyrics, for unit tests
// ============================================================
//
// `useLrcGenController` takes about thirty deps, most of which any given test
// never touches. This wires the ones that matter — the lyrics going in and the
// timings coming out — and stubs the rest, so a test can be about the edit it
// is making rather than about session plumbing.

import type { Accessor } from 'solid-js'
import { createRoot, createSignal } from 'solid-js'
import type { BlockInstancesMap, CanonicalLrcEntry, GenViewLine, WordSweepTimingsMap, WordTimingsMap, } from '@/features/stem-mixer/types'
import type { LrcGenController, LrcGenControllerDeps, } from '@/features/stem-mixer/useLrcGenController'
import { useLrcGenController } from '@/features/stem-mixer/useLrcGenController'
import type { LrcLine } from '@/lib/lyrics-service'

export interface LrcGenHarness {
  gen: LrcGenController
  sweeps: Accessor<WordSweepTimingsMap>
  starts: Accessor<WordTimingsMap>
  ends: Accessor<WordTimingsMap>
  setElapsed: (t: number) => void
  dispose: () => void
}

export interface LrcGenHarnessOptions {
  /** One entry per line, in canonical order. */
  lines: string[]
  /** Line start times, defaulting to ten seconds apart. */
  lineTimes?: number[]
  /**
   * Per-word stamps as an LRC would carry them, keyed by line index. Left out,
   * the song has line starts only — the plain-LRC case.
   */
  wordTimes?: Record<number, number[]>
  sessionId?: string
}

export function makeLrcGenHarness(
  options: LrcGenHarnessOptions,
): LrcGenHarness {
  const { lines } = options
  const lineTimes = options.lineTimes ?? lines.map((_line, i) => i * 10)

  const entries: CanonicalLrcEntry[] = lines.map((text, i) => ({
    type: 'line',
    lrcIndex: i,
    canonicalIndex: i,
    time: lineTimes[i],
    text,
    words: text.split(/\s+/).filter((word) => word.length > 0),
    wordTimes: options.wordTimes?.[i],
  }))

  let dispose = () => {}
  let gen!: LrcGenController
  const [elapsed, setElapsed] = createSignal(0)
  const [wordTimings, setWordTimings] = createSignal<WordTimingsMap>({})
  const [wordEndTimings, setWordEndTimings] = createSignal<WordTimingsMap>({})
  const [wordSweepTimings, setWordSweepTimings] =
    createSignal<WordSweepTimingsMap>({})
  const [lyricsLines, setLyricsLines] = createSignal<string[]>(lines)
  const [lrcLines, setLrcLines] = createSignal<LrcLine[]>(
    lines.map((text, i) => ({ time: lineTimes[i], text })),
  )
  const [rawLyricsText, setRawLyricsText] = createSignal(lines.join('\n'))
  const [lyricsSource, setLyricsSource] = createSignal<'api'>('api')
  const [editBuffer] = createSignal<WordTimingsMap>({})
  const [blocks] = createSignal([])
  const [blockInstances] = createSignal<BlockInstancesMap>({})
  const [genViewData] = createSignal<GenViewLine[]>([])
  const [canonicalLrcLines] = createSignal(entries)

  const deps = {
    sessionId: options.sessionId ?? 'lrc-gen-harness',
    elapsed,
    playing: () => true,
    seekToWithWindow: () => {},
    duration: () => 120,
    lyricsLines,
    setLyricsLines,
    lrcLines,
    setLrcLines,
    rawLyricsText,
    setRawLyricsText,
    lyricsSource,
    setLyricsSource,
    canonicalLrcLines,
    wordTimings,
    setWordTimings,
    wordEndTimings,
    setWordEndTimings,
    wordSweepTimings,
    setWordSweepTimings,
    editBuffer,
    setEditMode: () => {},
    blocks,
    blockInstances,
    getBlockById: () => undefined,
    getBlockForLine: () => null,
    genViewData,
    loadPersistedLyrics: () => null,
    persistLyrics: () => {},
  } as unknown as LrcGenControllerDeps

  createRoot((disposer) => {
    dispose = disposer
    gen = useLrcGenController(deps)
  })

  return {
    gen,
    sweeps: () => gen.lrcGenWordSweepTimings(),
    starts: () => gen.lrcGenWordTimings(),
    ends: () => gen.lrcGenWordEndTimings(),
    setElapsed,
    dispose,
  }
}
