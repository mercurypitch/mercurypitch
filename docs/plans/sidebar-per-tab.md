# Sidebar per tab — audit and plan

Status: **agreed 2026-08-12, in progress** on `feat/sidebar-per-tab`.
Decisions taken: full panel registry (§3, not cheap gating) · Karaoke session
groups + setlists move into the rail (§4) · the rail is THE jam roster
(JamPanel's duplicate goes) · Settings shows universal panels only. For the
§7 questions not decided explicitly: queue-status card renders only while a
batch runs; the Analysis take-picker stays in the dashboard for now; Guitar
adopts the rail per the matrix; Daily Routine stays per-tab as in the matrix.

## 1. The problem

`AppSidebar.tsx` renders the same nine sections on every tab:

| #   | Section                                | Gate today                                           |
| --- | -------------------------------------- | ---------------------------------------------------- |
| 1   | Learn / Guide / Tour buttons           | always                                               |
| 2   | Character picker                       | always                                               |
| 3   | Library (melody presets)               | always                                               |
| 4   | Playback Setup (key / scale / octave)  | `showPlaybackSetupInfo()` setting — not tab          |
| 5   | Mic & Sensitivity                      | always (`isMicTab()` returns `true` unconditionally) |
| 6   | Daily Routine                          | always                                               |
| 7   | Activity (streak + heatmap)            | advanced mode                                        |
| 8   | Note list                              | Singing/Settings only — the one tab-aware section    |
| 9   | Display toggles (ball/playhead/grid/…) | advanced mode                                        |

That set was designed for the Singing tab and is right there. Everywhere else
it decays into noise:

- **Karaoke**: key/scale, characters and the melody library are meaningless —
  the mixer has its own transport, and songs come from UVR sessions, not the
  melody library. Everything relevant (setlist queue, session groups,
  playlists) lives _inside_ the panel, fighting for vertical space — which is
  the same laptop-height problem as the upload queue.
- **Jam**: the room roster, role, and share state live in `JamPanel`; the
  sidebar shows a character picker for a surface that has no characters.
- **Community / Leaderboard**: nothing in the sidebar relates to browsing
  shares or rankings. Profile, filters, "your rank" would.
- **Piano / Guitar / Compose**: partially relevant (library yes, characters
  no; Guitar has its own tuner/device controls in-page).
- **Home / Path / Challenges**: routine + activity are right; key/scale and
  note list are dead weight.

Symptoms of the same root cause: the sidebar is a fixed component with
hard-coded content, not a surface tabs can populate.

## 2. What is genuinely working (keep)

- **Mic & Sensitivity everywhere.** The header comment in AppSidebar already
  documents why: one global setting, no tab where changing it is meaningless.
  This stays universal.
- **Learn / Guide / Tour** buttons — universal, top position. `Tour` is
  already tab-aware via `hasPageTour(activeTab())`.
- **Collapse / off-canvas mechanics** (`sidebarCollapsed`, `sidebarOpen`,
  tour-engine integration). Untouched by this plan.
- The header's "now loaded" context chip deep-links into sidebar sections
  (`triggerTargetFocus('sidebar-library')`) — any restructure must keep those
  anchor ids working.

## 3. Proposed architecture: a slot registry, not a rewrite

Keep one `AppSidebar` shell (collapse, close, Learn/Guide/Tour header, CSS).
Replace the hard-coded middle with an ordered list of **panels** resolved per
tab:

```ts
// src/features/sidebar/sidebar-registry.ts
export interface SidebarPanel {
  id: string                    // stable anchor for tours + triggerTargetFocus
  component: Component
  /** collapsible section title; storageKey derives from id */
  title?: string
  /** advanced-mode only, mirrors today's uiMode() gates */
  advancedOnly?: boolean
}

export const SIDEBAR_LAYOUT: Record<ActiveTab, SidebarPanelId[]> = { … }
```

Rules:

1. **Panels are dumb and importable** — each is a small component reading
   stores directly (the pattern the sections already follow). No prop
   drilling; today's `AppSidebarProps` mostly forwards store data that panels
   can read themselves (`melodyStore`, `currentPitch` …). Callbacks that truly
   need App (octave shift, auto-calibrate, scale builder) move behind small
   store-level functions or stay as a context object passed to the shell once.
2. **Order in the array = order on screen.** Universal panels (`mic`,
   `learn-guide`) are prepended/appended by the shell, not listed per tab.
3. **Persisted open/closed state keys stay per-panel** (`sidebar-<id>-open`),
   so existing user preferences survive.
4. **Lazy where heavy** — Community/Jam panels load with their tab's chunk,
   not in the shell (`lazy()` per panel keeps Home's first paint clean).
5. **Tour selectors** (`data-tour="singing.*"`) live inside the panel
   components, so steps keep resolving wherever the panel is mounted.

This is deliberately _not_ a portal API ("any page can teleport anything into
the sidebar") — a registry is greppable, the tour engine can reason about it,
and it can't leak page-lifetime state into an app-lifetime surface.

## 4. The matrix — what each tab shows

Universal (every tab): **Learn/Guide/Tour** (top) · **Mic & Sensitivity**
(bottom half). Everything else per tab, in order:

| Tab             | Panels (top → bottom)                                                                                                                                                                                                      | New?                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Singing**     | Character · Library · Playback Setup · Daily Routine · Activity° · Note list° · Display toggles°                                                                                                                           | as today                                   |
| **Exercises**   | Character · Daily Routine · **Exercise progress** (per-type stats + sparkline from `exercise-history-store` / `SparklineChart`) · **Weakness panel** (exists: `WeaknessPanel.tsx`) · Activity°                             | 2 reuses                                   |
| **Home**        | Character · Daily Routine · Activity° · **This week's challenge teaser** (deep-link to Challenges)                                                                                                                         | 1 new, small                               |
| **Path**        | Daily Routine · **Path progress** (current week orb, % complete, next step) · Activity°                                                                                                                                    | 1 new                                      |
| **Piano**       | Library (MIDI songs — `saved-midi-songs-store`) · Playback Setup · **Transport prefs** (tempo/count-in from `transport-store`) · Display toggles°                                                                          | reuses stores                              |
| **Guitar**      | **Song/tab library** (saved MIDI + GP imports) · **Tuner shortcut** · Transport prefs                                                                                                                                      | reuse in-page pieces                       |
| **Compose**     | Library · Playback Setup (transposes — already special-cased) · Note list                                                                                                                                                  | as today minus Character                   |
| **Karaoke**     | **Session groups / setlists** (lift `SessionGroupTabs` + playlist gallery entry points out of the panel body) · **Queue status** (mini mirror of the setlist queue: N waiting / current track %) · **Credits + mode** chip | the big win; frees in-panel vertical space |
| **Jam**         | **Room card** (room id, mode, share/copy — from `jam-store`) · **Peers roster** (who's in, roles, mic state) · **Jam catalog shortcut**                                                                                    | the second big win                         |
| **Community**   | **Your profile card** (`ProfileView` exists in `features/community`) · **Filters** (instrument/type) · Activity°                                                                                                           | reuses ProfileView                         |
| **Leaderboard** | **Your rank card** · **League/week picker**                                                                                                                                                                                | new, small                                 |
| **Challenges**  | **Weekly challenge card** (target, your best, attempts left) · Activity°                                                                                                                                                   | new, small                                 |
| **Analysis**    | **Take list / compare picker** (dashboard already has one — decide which side owns it) · Display toggles°                                                                                                                  | move, not build                            |
| **Settings**    | _none_ (settings is already a full-width form; sidebar shows universal panels only)                                                                                                                                        | shrink                                     |

° = advanced mode only, as today.

Character stays only where a voice character is actually used by the engine
(Singing, Exercises, Home). Library stays where the melody library feeds the
surface (Singing, Piano, Compose, Guitar-as-songs).

## 5. What this deliberately does NOT do

- **No second sidebar on the right.** Karaoke/Jam content moves into the one
  existing rail; two rails don't fit laptop widths (the trigger for the queue
  bug above).
- **No sidebar on mobile beyond today's drawer.** The BottomTabBar +
  options-sheet pattern already owns phone layouts; the registry only decides
  drawer content.
- **No moving the mixer's own controls** (faders, lyrics) into the sidebar —
  they are performance surfaces and stay with the stage.

## 6. Migration order (each step shippable alone)

1. **Registry + shell refactor, zero visual change** — encode today's exact
   layout in `SIDEBAR_LAYOUT` with every tab mapping to the current section
   list. Pure refactor, provable with screenshots.
2. **Subtractions** — remove the dead sections per the matrix (Character off
   Karaoke/Jam/Community/…, Library off Karaoke/Jam, Playback Setup off
   non-musical tabs). Instant noise reduction, no new components.
3. **Karaoke panels** — session groups + queue status in the rail. Solves the
   same vertical-space class of bug as the upload-queue fix.
4. **Jam panels** — room card + roster.
5. **Community / Leaderboard / Challenges / Path cards** — small, mostly
   reusing existing components (`ProfileView`, challenge stores).
6. Tour pass: re-point any `PAGE_TOURS` steps whose targets moved; update
   tours to cover new panels (AGENTS.md: tours cover ≥80% of a page's
   features — additions in the same PR).

## 7. Open questions (the brainstorm)

1. **Karaoke queue in the sidebar vs. in-panel only?** A mini queue-status
   card duplicates state visible in the panel — worth it for glanceability
   during long batches, or noise? (Lean: yes while running, hidden when idle.)
2. **Analysis take-picker ownership** — dashboard column vs sidebar. Moving it
   makes the dashboard wider; keeping it makes the sidebar useless there.
3. **Should Settings hide the rail entirely** rather than show universal
   panels? (Today it shows everything; the matrix says universal-only.)
4. **Guitar**: the page manages its own small-screen layout — does it adopt
   the shared rail or keep its in-page panels and set `SIDEBAR_LAYOUT.guitar`
   to universal-only?
5. **Jam roster**: duplicate of JamPanel's roster or the _only_ roster (freeing
   JamPanel space the way Karaoke frees panel space)?
6. Does **Daily Routine** deserve universal placement (it is the retention
   surface) or per-tab as in the matrix?
