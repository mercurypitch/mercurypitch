// ============================================================
// Tap or sing, chosen on a station's sheet before the run (the owner's
// call, 31 Oct), not under "?" mid-run: which of a station's drills take a
// sung answer, and the choice each remembers. Home and Gravity share
// Home's; Echo, Span and Echo in the Wild keep one each (ear-lab-store).
// A station row's run starts in the choice its drill remembers.
// ============================================================

import type { AnswerMode } from '@/features/ear-lab/answer-mode'
import type { FacultyId } from '@/lib/ear/drills'
import { WILD_DRILLS } from '@/lib/ear/wild'
import { earAnswerMode, homeAnswerMode, setEarAnswerMode, setHomeAnswerMode, } from '@/stores/ear-lab-store'
import { drillName, instrumentName, stationInstruments } from './stations'

/** The drills a station's sheet offers to sing, by the station. */
const SUNG_DRILLS: Partial<Record<FacultyId, readonly string[]>> = {
  function: ['home', 'gravity'],
  shape: ['echo', 'span'],
  wild: ['wild-echo'],
}

/** Gravity is Home's drill over twelve degrees, and answers as Home does. */
const HOME_DRILLS = new Set(['home', 'gravity'])

export function sungDrills(faculty: FacultyId): readonly string[] {
  return SUNG_DRILLS[faculty] ?? []
}

export function answerModeOf(drillId: string): AnswerMode {
  return HOME_DRILLS.has(drillId) ? homeAnswerMode() : earAnswerMode(drillId)
}

/** The station's choice while its drills agree; none while they differ,
 *  as when one was sung on the web and the other tapped. */
export function stationAnswerMode(faculty: FacultyId): AnswerMode | null {
  const modes = new Set(sungDrills(faculty).map(answerModeOf))
  const [only] = modes
  return modes.size === 1 && only !== undefined ? only : null
}

export function setStationAnswerMode(
  faculty: FacultyId,
  mode: AnswerMode,
): void {
  for (const drillId of sungDrills(faculty)) {
    if (HOME_DRILLS.has(drillId)) setHomeAnswerMode(mode)
    else setEarAnswerMode(drillId, mode)
  }
}

/** A sung drill's name: the Wild's own ("Echo in the Wild"), which the
 *  bench's catalogue does not hold, or the bench's. */
function sungName(drillId: string): string {
  const wild: Partial<Record<string, { name: string }>> = WILD_DRILLS
  return wild[drillId]?.name ?? drillName(drillId)
}

function joinNames(names: readonly string[]): string {
  if (names.length < 2) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Under the switch: "Echo and Span take your voice. Leap and Contour
 *  stay tapped." The Wild lists songs, so it names its drill alone. */
export function voiceLine(faculty: FacultyId): string {
  const sung = sungDrills(faculty)
  const voice = `${joinNames(sung.map(sungName))} ${
    sung.length === 1 ? 'takes' : 'take'
  } your voice.`
  if (faculty === 'wild') return voice
  const tapped = stationInstruments(faculty)
    .filter((instrument) => !sung.includes(instrument.drillId ?? ''))
    .map(instrumentName)
  if (tapped.length === 0) return voice
  return `${voice} ${joinNames(tapped)} ${
    tapped.length === 1 ? 'stays' : 'stay'
  } tapped.`
}
