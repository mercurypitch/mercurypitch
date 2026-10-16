// ============================================================
// Merc's lines in a glide room: a table's next line, its fields filled
// ============================================================
//
// Each glide room keeps its own table of lines (Lip roll's and Ng slides'
// merc-lines.ts), keyed by its moments; the room kit's selector
// (line-selector.ts) picks the next one and never says the same line twice
// running. `{note}` is a note ("G3"), `{top}` an arch's top note, `{pct}`
// a share ("88%"). The core (useGlideRoom.ts) says five moments of its own,
// so every glide room's table has them: GlideCoreMoment.

import type { MercLine } from '@/components/room-kit/line-selector'
import { createLineSelector } from '@/components/room-kit/line-selector'

/** The moments the core itself speaks at: every glide room's table has them. */
export type GlideCoreMoment = 'found' | 'listen' | 'rest' | 'left' | 'again'

/** What a line's placeholders become. */
export interface GlideLineFields {
  readonly note?: string
  readonly top?: string
  readonly pct?: string
}

/** A moment to speak at, and its fields: what a room's run module returns. */
export interface GlideLine<M extends string> {
  readonly moment: M
  readonly fields: GlideLineFields
}

export interface GlideLines<M extends string> {
  next: (moment: M, fields?: GlideLineFields) => string
}

export function createGlideLines<M extends string>(
  table: Readonly<Record<M, readonly MercLine[]>>,
  random: () => number,
): GlideLines<M> {
  const selector = createLineSelector(table, random)
  return {
    next: (moment, fields = {}) =>
      selector
        .next(moment, fields.note ?? '{note}')
        .replaceAll('{top}', fields.top ?? '{top}')
        .replaceAll('{pct}', fields.pct ?? '{pct}'),
  }
}
