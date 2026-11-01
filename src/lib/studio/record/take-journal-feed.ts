// ============================================================
// Studio take journal feed — a recording take's audio written to its journal about once a second, in order, never after the take is let go
// ============================================================
//
// The journal (studio-take-journal.ts) keeps a take through a closed tab.
// Writes go one after another on a single chain, so a row never lands
// after the take's discard and the rows stay in sequence. A write that
// fails is let go: the journal is the safety net, not the take itself,
// which stays whole in memory until it is kept.
import type { StudioTakeJournalHeader, StudioTakeJournalWriter, } from './recorder-types'
import { floatToPcm16 } from './take-audio'

/** A journal row holds about this much audio. */
export const STUDIO_JOURNAL_SECONDS = 1

export function createStudioTakeJournalFeed(
  journal: StudioTakeJournalWriter | undefined,
  header: StudioTakeJournalHeader,
) {
  let writes: Promise<unknown> = Promise.resolve()
  let sequence = 0
  let from = 0
  let pending: Float32Array[] = []
  let frames = 0
  let closed = false
  const chain = (
    write: (journal: StudioTakeJournalWriter) => Promise<unknown>,
  ) => {
    if (journal === undefined) return
    writes = writes.then(() => write(journal)).catch(() => undefined)
  }
  chain((journal) => journal.begin(header))

  function flush(): void {
    if (closed || frames === 0) return
    const pcm = new Int16Array(frames)
    let at = 0
    for (const samples of pending) {
      pcm.set(floatToPcm16(samples), at)
      at += samples.length
    }
    const row = { sequence: sequence++, firstFrame: from }
    from += frames
    pending = []
    frames = 0
    chain((journal) =>
      journal.append(header.id, row.sequence, row.firstFrame, pcm),
    )
  }

  return {
    /** The first sample's song frame, now known for certain. */
    place(heardFirst: number): void {
      if (!closed) chain((journal) => journal.place(header.id, heardFirst))
    },
    push(samples: Float32Array): void {
      if (journal === undefined || closed) return
      pending.push(samples)
      frames += samples.length
      if (frames >= header.sampleRate * STUDIO_JOURNAL_SECONDS) flush()
    },
    /** Write what is not written yet: the take was not kept, or the Studio closed. */
    flush,
    /** The take is kept or dropped: its rows go, after any write on its way. */
    discard(): void {
      if (closed) return
      closed = true
      pending = []
      frames = 0
      chain((journal) => journal.discard(header.id))
    },
    /** Every write so far has landed or failed. */
    settled: (): Promise<unknown> => writes,
  }
}

export type StudioTakeJournalFeed = ReturnType<
  typeof createStudioTakeJournalFeed
>
