// ============================================================
// Merc's lines in a room: a table's next line, its fields filled
// ============================================================
//
// Every room's lines go through here: Echo's, Long note's, Lip roll's and
// Ng slides' (each room's merc-lines.ts). A room keeps a table of lines
// keyed by its moments, a few variants a moment; createRoomLines picks the
// next one for a moment, never the same line twice running, and fills its
// `{name}` fields from what the room hands it.
//
// What lives here, because every room does it the same way:
//   MercLine, LineTable   a line (an id and its words) and a room's table
//   RoomLine              a moment to speak at and its fields, as a room's
//                         run module returns it
//   fillLine              `{name}` becomes the field's value; a field left
//                         out keeps its `{name}`
//   createRoomLines       the pick (never the line just said for that
//                         moment, a broken random source taking the first)
//                         and the fill, in one `next(moment, fields)`, or
//                         with the line's id in `line(moment, fields)`, for
//                         a room that says it aloud (merc-speech.ts)
//
// What stays in a room, because it is that room's alone:
//   its table (the words) and its moments
//   its fields: Echo's are a note, a note's place in the phrase (nthNote),
//     the notes sung and asked for, counts and the level's name; Long
//     note's only the note; the glide rooms' a note, an arch's top and a
//     share (GlideLineFields, with GlideCoreMoment, in the glide core's
//     contract, glide-room-contract.ts)
//   Long note's `next(moment, note)`: its one field by position, as its
//     controller and tests call it, and a table of a test's own
//   Long note's rules on top of the pick: which moments may call a voice
//     steady (STEADY_CLAIMS) and which moment a voice off the band earns
//     (offMoment)
//
// None of the four rooms rotates, weights, remembers lines across takes or
// keeps a first-visit line: the memory is the last line per moment, for as
// long as the room's lines live (a room makes them once).

/** One of Merc's lines. */
export interface MercLine {
  /** Stable id: a recording of the line is named by it (merc-speech.ts). */
  readonly id: string
  readonly text: string
}

/** A room's lines: a few variants for each of its moments. */
export type LineTable<M extends string> = Readonly<
  Record<M, readonly MercLine[]>
>

/** A field's value: a note's name ("A3"), a count, a share ("88%"). */
export type LineValue = string | number

/**
 * A room's fields: each one optional, a `{name}` in its lines. Self-keyed,
 * so a room's own interface (Echo's LineFields) fits as it is.
 */
export type LineFieldsOf<F> = { readonly [K in keyof F]?: LineValue }

/** A moment to speak at, and its fields: what a room's run module returns. */
export interface RoomLine<M extends string, F extends LineFieldsOf<F>> {
  readonly moment: M
  readonly fields: F
}

export interface RoomLines<M extends string, F extends LineFieldsOf<F>> {
  /** The next line for a moment, its fields filled in. */
  next(moment: M, fields?: F): string
  /**
   * The same, with the line's id: a room that says the line aloud names
   * the recording by it (merc-speech.ts).
   */
  line(moment: M, fields?: F): MercLine
}

/** Every `{name}` the fields give becomes its value; the rest stay as they are. */
export function fillLine<F extends LineFieldsOf<F>>(
  text: string,
  fields: F,
): string {
  const values = fields as Readonly<Record<string, LineValue | undefined>>
  return text.replace(/\{(\w+)\}/gu, (whole, name: string) => {
    const value = Object.hasOwn(values, name) ? values[name] : undefined
    return value === undefined ? whole : String(value)
  })
}

/** Merc's next line for a moment, never the same one twice running. */
export function createRoomLines<M extends string, F extends LineFieldsOf<F>>(
  table: LineTable<M>,
  random: () => number = Math.random,
): RoomLines<M, F> {
  const last = new Map<M, string>()
  const pick = (moment: M): MercLine => {
    const all = table[moment]
    const previous = last.get(moment)
    const pool =
      all.length > 1 ? all.filter((line) => line.id !== previous) : all
    const sample = random()
    const index = Number.isFinite(sample)
      ? Math.min(pool.length - 1, Math.max(0, Math.floor(sample * pool.length)))
      : 0
    const line = pool[index]
    last.set(moment, line.id)
    return line
  }
  const line = (moment: M, fields?: F): MercLine => {
    const picked = pick(moment)
    return { id: picked.id, text: fillLine(picked.text, fields ?? {}) }
  }
  return {
    next: (moment, fields) => line(moment, fields).text,
    line,
  }
}
