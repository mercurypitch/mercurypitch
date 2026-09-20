// ============================================================
// row-fit — does a wrapping row still hold on one line?
// ============================================================
//
// For the one thing CSS cannot say: "drop your words BEFORE the row wraps".
// A wrapping flex row decides its line breaks from what each item asks for,
// and only then shrinks anything, so an item that is willing to give way is
// never asked -- it is sent to the next line with its words intact. The
// only way to know whether the words fit is to lay them out and look.
//
// So the caller tries the long form, asks this, and falls back to the short
// one in the same task. Nothing is painted in between, and the answer
// cannot flap: it depends on the layout alone, not on the state before it.

/** A second line is at least this many times the height of one item. */
const ONE_LINE_FACTOR = 1.8

/**
 * True while `row` is one line tall and nothing runs past its end.
 *
 * `unit` is the height of an ordinary item in it. Measuring the row against
 * one of its own items, rather than comparing the items' tops, also catches
 * a CHILD that wrapped inside itself -- a list of people two rows deep makes
 * the header as tall as a wrapped strip does.
 *
 * A row that scrolls sideways instead of wrapping (the phone's) is asked the
 * second question: whether it has anything off its end.
 */
export function rowHoldsOneLine(row: HTMLElement, unit: number): boolean {
  if (unit > 0 && row.clientHeight > unit * ONE_LINE_FACTOR) return false
  return row.scrollWidth <= row.clientWidth + 1
}
