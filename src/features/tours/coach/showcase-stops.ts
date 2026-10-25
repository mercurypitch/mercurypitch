// ============================================================
// Showcase stops — where Merc stands on the tab bar, and what he says there
// ============================================================
//
// "Show me around" on the plan (D6): Merc hops along the real tab bar, one
// stop at a time, and then the plan's Start here opens. The stops are worked
// out from the menu as it stands (the practice scope and the mode), so every
// line is true of what it is said over:
//
// - A wide screen gets one stop per group of the top bar (AppNavTabs'
//   `[data-tab-group]`). A group that holds none of what its line names drops
//   its stop: Simple mode hides Play's rooms and Studio's Analysis, and a
//   guitar or piano menu hides Karaoke, Jam and Analysis.
// - A phone gets the bottom rail's four tabs, in the rail's order
//   (mobileBarTabs), each found by the id the rail gives its button, and then
//   More, which the stop opens and closes again. Its line names only rooms the
//   sheet holds.
//
// The lines are drafts for maff's copy pass. They name the tabs as the bar
// labels them (tabLabel), so the instrument the singing tab holds reads
// "Singing", as its button does.

import type { ActiveTab, PracticeScope, UiMode, } from '@/features/tabs/constants'
import { isTabVisible, mobileBarTabs, TAB_ANALYSIS, TAB_COMMUNITY, TAB_COMPOSE, TAB_EAR_LAB, TAB_EXERCISES, TAB_GUITAR, TAB_HOME, TAB_JAM, TAB_KARAOKE, TAB_PATH, TAB_PIANO, TAB_PROGRESS, TAB_SINGING, TAB_VOICE_HISTORY, tabLabel, visibleTabOrder, } from '@/features/tabs/constants'

export interface ShowcaseStop {
  /** The group's id on a wide screen, the tab's (or `more`) on a phone. */
  id: string
  /** What Merc stands by: a selector for one element of the tab bar. */
  target: string
  line: string
  /**
   * The stop opens its target with a tap and closes what that opened as it
   * moves on; this finds what opened, which Merc then stands by.
   */
  opens?: string
}

/** How long Merc stands at a stop before he hops on by himself, in ms. */
export const STOP_MS = 2500

/**
 * The id the phone's rail gives each tab it can hold: TAB_META's
 * (AppNavTabs.tsx), which is not always the tab's own name. Kept here so the
 * coach does not load the desktop bar; showcase-stops.test.ts holds the two
 * together.
 */
export const RAIL_IDS: Partial<Record<ActiveTab, string>> = {
  [TAB_HOME]: 'tab-home',
  [TAB_PATH]: 'tab-path',
  [TAB_PROGRESS]: 'tab-progress',
  [TAB_SINGING]: 'tab-singing',
  [TAB_GUITAR]: 'tab-guitar',
  [TAB_PIANO]: 'tab-falling-notes',
  [TAB_EXERCISES]: 'tab-exercises',
}

const RAIL = 'nav[data-tour="mobile-tabbar"]'
const MORE = '[data-tour="mobile-tabbar-more"]'
const MORE_SHEET = '[data-testid="sheet-panel"][aria-label="More tabs"]'

const HOME_LINE = "Home is your day: today's session and your streak."
const PATH_LINE = 'The Ascent: a new climb every week.'
const PROGRESS_LINE = "Progress: every take, and how it's moving."
const PLAY_LINE = 'Karaoke with your own songs. Jam with a friend.'
const STUDIO_LINE = 'Your takes, read in plain words.'

const INSTRUMENT_TABS: readonly ActiveTab[] = [
  TAB_SINGING,
  TAB_GUITAR,
  TAB_PIANO,
]

/** The rooms the More line may name, most telling first; at most three are. */
const MORE_NAMES: readonly ActiveTab[] = [
  TAB_KARAOKE,
  TAB_JAM,
  TAB_EAR_LAB,
  TAB_EXERCISES,
  TAB_VOICE_HISTORY,
  TAB_COMMUNITY,
  TAB_COMPOSE,
]

export interface ShowcaseMenu {
  /** A phone's layout: the bottom rail and More, rather than the top bar's groups. */
  phone: boolean
  /** The menu as it stands, which says what the tab bar holds. */
  scope: PracticeScope
  mode: UiMode
}

function desktopStops(scope: PracticeScope, mode: UiMode): ShowcaseStop[] {
  const shown = (tab: ActiveTab): boolean => isTabVisible(tab, scope, mode)
  const instrument = INSTRUMENT_TABS.find(shown) ?? TAB_SINGING
  const group = (id: string, line: string): ShowcaseStop => ({
    id,
    target: `[data-tab-group="${id}"]`,
    line,
  })
  const stops = [
    group('you', HOME_LINE),
    group('practice', `${tabLabel(instrument)} lives here, with the drills.`),
  ]
  if (shown(TAB_KARAOKE) && shown(TAB_JAM)) stops.push(group('play', PLAY_LINE))
  if (shown(TAB_ANALYSIS)) stops.push(group('studio', STUDIO_LINE))
  return stops
}

function railLine(tab: ActiveTab): string {
  if (tab === TAB_HOME) return HOME_LINE
  if (tab === TAB_PATH) return PATH_LINE
  if (tab === TAB_PROGRESS) return PROGRESS_LINE
  return `${tabLabel(tab)} lives here.`
}

function moreLine(inMore: readonly ActiveTab[]): string {
  const names = MORE_NAMES.filter((tab) => inMore.includes(tab))
    .slice(0, 3)
    .map(tabLabel)
  if (names.length === 0) return 'Everything else lives here.'
  return `Everything else lives here: ${names.join(', ')} and the rest.`
}

function phoneStops(scope: PracticeScope, mode: UiMode): ShowcaseStop[] {
  const rail = mobileBarTabs(scope, mode)
  const inMore = visibleTabOrder(scope, mode).filter(
    (tab) => !rail.includes(tab),
  )
  const stops: ShowcaseStop[] = []
  for (const tab of rail) {
    const id = RAIL_IDS[tab]
    if (id !== undefined) {
      stops.push({ id: tab, target: `${RAIL} #${id}`, line: railLine(tab) })
    }
  }
  stops.push({
    id: 'more',
    target: MORE,
    line: moreLine(inMore),
    opens: MORE_SHEET,
  })
  return stops
}

/** The stops of the showcase for this screen and menu, in the order Merc takes them. */
export function showcaseStops(menu: ShowcaseMenu): ShowcaseStop[] {
  return menu.phone
    ? phoneStops(menu.scope, menu.mode)
    : desktopStops(menu.scope, menu.mode)
}
