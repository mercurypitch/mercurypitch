// ============================================================
// Achievement icons — one glyph per thing you can earn
// ============================================================
//
// The achievement set grew from thirteen entries to three shelves of them,
// and the old set only had a glyph for about a third. The rest fell to
// iconByName's generic-badge fallback, which is fine as a safety net and
// terrible as a design: a page of identical grey badges says nothing about
// what any of them is for.
//
// House style, matching hidden-features-icons: 24x24 viewBox, no fill,
// currentColor stroke at 2, round caps and joins, `icon-svg` for sizing.
// Line art only — these render at 20-32px next to a name, so anything
// finer than a couple of strokes turns to mush.
//
// Registered by NAME in the shared iconMap (see hidden-features-icons), and
// the seeded `icon` strings are what look them up. src/tests/seed-icons.test.ts
// fails if a seeded name has no glyph here.

import type { Component } from 'solid-js'
import type { JSX } from 'solid-js'

/** Shared frame — every icon below is just its paths. */
const Glyph = (props: { children: JSX.Element }): JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-svg"
  >
    {props.children}
  </svg>
)

/** A day ticked off on a calendar — showing up, counted. */
const IconCalendarCheck: Component = () => (
  <Glyph>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    <path d="m8.5 14.5 2.5 2.5 4.5-5" />
  </Glyph>
)

/** A hundred: a full ring with the count struck through it. */
const IconCentury: Component = () => (
  <Glyph>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 8.5 8 9.75V16" />
    <path d="M14 9.5v5" />
    <path d="M17 9.5v5" />
  </Glyph>
)

/** A tick inside a rosette — a run that cleared the bar. */
const IconCheckBadge: Component = () => (
  <Glyph>
    <path d="M12 2.7l2.2 1.9 2.9-.3 1 2.7 2.6 1.4-.8 2.8.8 2.8-2.6 1.4-1 2.7-2.9-.3L12 21.3l-2.2-1.9-2.9.3-1-2.7L3.3 15.6l.8-2.8-.8-2.8 2.6-1.4 1-2.7 2.9.3z" />
    <path d="m9 12 2 2 4-4.5" />
  </Glyph>
)

/** A mug — the weekend voice, singing on your own time. */
const IconCoffee: Component = () => (
  <Glyph>
    <path d="M4 8.5h13v6a4.5 4.5 0 0 1-4.5 4.5h-4A4.5 4.5 0 0 1 4 14.5z" />
    <path d="M17 10.5h1.75a2.75 2.75 0 0 1 0 5.5H17" />
    <path d="M7.5 2.5v3M11.5 2.5v3" />
  </Glyph>
)

/** A dumbbell — the drills. */
const IconDumbbell: Component = () => (
  <Glyph>
    <path d="M3 9.5v5M6.5 7v10M17.5 7v10M21 9.5v5" />
    <path d="M6.5 12h11" />
  </Glyph>
)

/** A planted flag — a week of the Ascent finished. */
const IconFlag: Component = () => (
  <Glyph>
    <path d="M6 21V3" />
    <path d="M6 4.5h11l-2.5 4 2.5 4H6" />
  </Glyph>
)

/** A taller flame than `fire` — the long streaks. */
const IconFlameTall: Component = () => (
  <Glyph>
    <path d="M12 2.5c3.2 4 4.8 6.6 4.8 9.2a4.8 4.8 0 0 1-9.6 0c0-1.3.5-2.6 1.4-4" />
    <path d="M12 21a2.9 2.9 0 0 1-2.9-2.9c0-1.6 2.9-4.1 2.9-4.1s2.9 2.5 2.9 4.1A2.9 2.9 0 0 1 12 21z" />
  </Glyph>
)

/** Two hands meeting — a friend added. */
const IconHandshake: Component = () => (
  <Glyph>
    <path d="m2.5 12 4-4 3.5 2.5 2-1.5 2 1.5L17.5 8l4 4-4 4-2-1.5" />
    <path d="M10 10.5 8 12.8a1.6 1.6 0 0 0 2.3 2.2l.5-.5.9.9a1.6 1.6 0 0 0 2.3-2.2" />
  </Glyph>
)

/** Stacked planes pulling apart — a song split into stems. */
const IconLayerSplit: Component = () => (
  <Glyph>
    <path d="m12 2.5 8 4-8 4-8-4z" />
    <path d="m4 13 8 4 8-4" />
    <path d="m4 18 8 4 8-4" />
  </Glyph>
)

/** A list with a note on it — a karaoke playlist. */
const IconListMusic: Component = () => (
  <Glyph>
    <path d="M3.5 6h10M3.5 11h7M3.5 16h6" />
    <circle cx="15" cy="18" r="2.6" />
    <path d="M17.6 18V8l3.9-1.4V16" />
  </Glyph>
)

/** A hanging medal — badges collected. */
const IconMedal: Component = () => (
  <Glyph>
    <path d="M8 2.5 10.5 9M16 2.5 13.5 9" />
    <circle cx="12" cy="15" r="6" />
    <path d="m12 12.2 1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" />
  </Glyph>
)

/** A mic on a stand — the karaoke stage. */
const IconMicStand: Component = () => (
  <Glyph>
    <rect x="8.5" y="2.5" width="7" height="10" rx="3.5" />
    <path d="M12 12.5V21" />
    <path d="M8 21h8" />
    <path d="M5.5 8.5a6.5 6.5 0 0 0 13 0" />
  </Glyph>
)

/** A moon with stars — the late practices. */
const IconMoonStars: Component = () => (
  <Glyph>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    <path d="M17 3v3M15.5 4.5h3M20.5 7.5v2M19.5 8.5h2" />
  </Glyph>
)

/** A peak with a route up it — the whole climb. */
const IconMountain: Component = () => (
  <Glyph>
    <path d="m2.5 19.5 6.5-12 4 6.5 2.5-4 6 9.5z" />
    <path d="m6.5 14 2.5-1.5 2 1" />
  </Glyph>
)

/** A cluster of notes — the count of them. */
const IconNoteCluster: Component = () => (
  <Glyph>
    <circle cx="7" cy="17.5" r="2.6" />
    <circle cx="17" cy="15" r="2.6" />
    <path d="M9.6 17.5V6.5l10-2v10.5" />
    <path d="M9.6 10.5l10-2" />
  </Glyph>
)

/** A quill — melodies you wrote. */
const IconQuill: Component = () => (
  <Glyph>
    <path d="M20.5 3.5c-8 .5-13 4.5-14.5 10.5l4 4c6-1.5 10-6.5 10.5-14.5z" />
    <path d="M3.5 20.5 10 14" />
  </Glyph>
)

/** Three nodes joined — putting work on the board. */
const IconShareNodes: Component = () => (
  <Glyph>
    <circle cx="18" cy="5.5" r="2.8" />
    <circle cx="6" cy="12" r="2.8" />
    <circle cx="18" cy="18.5" r="2.8" />
    <path d="m8.5 10.7 7-3.9M8.5 13.3l7 3.9" />
  </Glyph>
)

/** A shelf of things practised — the repertoire. */
const IconShelf: Component = () => (
  <Glyph>
    <path d="M3 20.5h18" />
    <path d="M5.5 20.5V9h3.5v11.5M11.5 20.5V5.5H15v15" />
    <path d="m17 20.5 1.5-9 3 .5-1.5 8.5" />
  </Glyph>
)

/** Layers stacked — more than one run in a day. */
const IconStack: Component = () => (
  <Glyph>
    <rect x="4" y="3" width="16" height="5" rx="1.6" />
    <rect x="4" y="10" width="16" height="5" rx="1.6" />
    <rect x="4" y="17" width="16" height="4" rx="1.6" />
  </Glyph>
)

/** A plain sun — the early sessions. */
const IconSun: Component = () => (
  <Glyph>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" />
  </Glyph>
)

/** A sun over the horizon — practising before the day starts. */
const IconSunrise: Component = () => (
  <Glyph>
    <path d="M2.5 19.5h19" />
    <path d="M6 15.5a6 6 0 0 1 12 0" />
    <path d="M12 2.5v4M4.5 8 6 9.5M19.5 8 18 9.5" />
  </Glyph>
)

/** A cup with handles — challenges cleared. */
const IconTrophyCup: Component = () => (
  <Glyph>
    <path d="M7 3.5h10v5a5 5 0 0 1-10 0z" />
    <path d="M7 5H4.5v2A3.5 3.5 0 0 0 8 10.5M17 5h2.5v2a3.5 3.5 0 0 1-3.5 3.5" />
    <path d="M12 13.5V17M8.5 20.5h7" />
    <path d="M9.5 17h5l1 3.5h-7z" />
  </Glyph>
)

/** A measured waveform — a voiceprint taken. */
const IconWaveform: Component = () => (
  <Glyph>
    <path d="M2.5 12h2M7 6.5v11M11 3.5v17M15 8v8M19 10.5v3M21.5 12h.5" />
  </Glyph>
)

/**
 * Every glyph this module adds, keyed by the name a seeded achievement
 * uses. Merged into the shared iconMap rather than replacing it — the
 * older names (fire, target, crown, …) still resolve from there.
 */
export const ACHIEVEMENT_ICONS: Record<string, Component> = {
  calendarcheck: IconCalendarCheck,
  century: IconCentury,
  checkbadge: IconCheckBadge,
  coffee: IconCoffee,
  dumbbell: IconDumbbell,
  flag: IconFlag,
  flame2: IconFlameTall,
  handshake: IconHandshake,
  layersplit: IconLayerSplit,
  listmusic: IconListMusic,
  medal: IconMedal,
  microstand: IconMicStand,
  moonstars: IconMoonStars,
  mountain: IconMountain,
  notecluster: IconNoteCluster,
  quill: IconQuill,
  share: IconShareNodes,
  shelf: IconShelf,
  stack: IconStack,
  sun: IconSun,
  sunrise: IconSunrise,
  trophy: IconTrophyCup,
  waveform: IconWaveform,
}
