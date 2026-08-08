# Settings Panel — EARS Requirements

Requirements for the settings surface: theme, transport defaults, instrument,
profile, and reset.

**Source:** `src/stores/settings-store.ts` — `SettingsConfig` and
`DEFAULT_SETTINGS`; `src/stores/transport-store.ts` — `bpm` (40-280, default
60), `countIn`; `src/stores/theme-store.ts` — `THEME_PRESETS`, `THEME_INFO`,
`THEME_SOURCES`; `src/components/SettingsPanel.tsx` — the panel UI;
`src/components/ThemePicker.tsx` — the theme grid and source control;
`src/stores/ui-store.ts` — `openSettingsSection`
**Tests:** `src/e2e/settings.spec.ts` (`REQ-SET-001..023`),
`src/tests/theme-store.test.ts` (`REQ-SET-024..029`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Theme — `REQ-SET-001..004`

### REQ-SET-001 — Nine presets

The user **shall** be able to select any theme in `THEME_PRESETS`: dark, light,
midnight, forest, ocean, cyberpunk, rose, amber, slate.

### REQ-SET-002 — Default is dark

**WHEN** no theme has been stored, the app **shall** use `dark`.

### REQ-SET-003 — Applies immediately

**WHEN** the user selects a theme, the app **shall** update the UI without a
reload.

### REQ-SET-004 — Persists

The selected theme **shall** persist across browser sessions.

## Tempo — `REQ-SET-005..008`

### REQ-SET-005 — Range

The user **shall** be able to set BPM within 40 to 280 inclusive.

### REQ-SET-006 — Default is 60

**WHEN** no BPM has been stored, the app **shall** use 60.

### REQ-SET-007 — Out-of-range values are clamped

**IF** a BPM outside 40-280 is submitted, **THEN** the app **shall** clamp it
to the nearest bound rather than reject or store it.

### REQ-SET-008 — Immediate effect

**WHEN** BPM changes, all playback **shall** adopt the new tempo without
restarting.

## Metronome — `REQ-SET-009..010`

### REQ-SET-009 — Exposed in settings

The settings panel **shall** expose the metronome toggle, sound type, and
volume.

### REQ-SET-010 — Behaviour is specified elsewhere

Metronome behaviour **shall** conform to
[metronome.ears.md](metronome.ears.md); this spec covers only its presence in
settings.

## Instrument — `REQ-SET-011..013`

### REQ-SET-011 — Selectable

The user **shall** be able to select the playback instrument.

### REQ-SET-012 — Default is sine

**WHEN** no instrument has been stored, the app **shall** use `sine`.

### REQ-SET-013 — Immediate effect

**WHEN** the instrument changes, subsequent notes **shall** use it without
requiring playback to restart.

## Count-in — `REQ-SET-014..016`

### REQ-SET-014 — Options

The user **shall** be able to select a count-in of 0, 1, 2, or 4 beats.

### REQ-SET-015 — Default is 0

**WHEN** no count-in has been stored, the app **shall** use 0.

### REQ-SET-016 — Applies to every mode

The count-in setting **shall** apply to all three playback modes.

## Profile — `REQ-SET-017..019`

### REQ-SET-017 — Editable name

The user **shall** be able to edit their display name in settings.

### REQ-SET-018 — Persists

The display name **shall** persist across sessions.

### REQ-SET-019 — Used for attribution

**WHEN** a melody is created, the app **shall** attribute it to the current
display name.

## Reset — `REQ-SET-020..023`

### REQ-SET-020 — Reset control

The settings panel **shall** offer a reset that restores every setting to its
default.

### REQ-SET-021 — Confirmation required

**WHEN** the user activates reset, the app **shall** require confirmation
before applying it.

### REQ-SET-022 — Cancel is inert

**IF** the user cancels the confirmation, **THEN** the app **shall** leave all
settings unchanged.

### REQ-SET-023 — Restores documented defaults

**WHEN** reset is confirmed, the app **shall** restore the defaults named in
this spec — theme `dark`, BPM 60, count-in 0, instrument `sine`.

## Theme auto-switch — `REQ-SET-024..029`

### REQ-SET-024 — Three sources

The user **shall** be able to set the theme source to `manual`, `system`, or
`time`. The default **shall** be `manual`.

### REQ-SET-025 — Day and night presets

**WHERE** the source is `system` or `time`, the app **shall** apply one of two
user-chosen presets — the day preset (default `light`) or the night preset
(default `dark`) — both selectable from all nine presets.

### REQ-SET-026 — System source

**WHILE** the source is `system`, the app **shall** apply the night preset when
`prefers-color-scheme: dark` matches and the day preset otherwise, and **shall**
re-apply **WHEN** that preference changes without a reload.

### REQ-SET-027 — Time source

**WHILE** the source is `time`, the app **shall** apply the day preset from
07:00 until 19:00 local time and the night preset otherwise, and **shall**
re-apply **WHEN** the clock crosses either boundary without a reload.

### REQ-SET-028 — Manual pick overrides

**WHEN** the user selects a preset from the grid, the app **shall** apply that
preset and set the source to `manual`.

### REQ-SET-029 — No media-query support

**IF** the host provides no `matchMedia`, **THEN** selecting the `system` source
**shall** apply the day preset rather than fail.

## Not specified here

Global output volume has no dedicated store; it is set directly on the audio
engine (`AudioEngine.setVolume`). Its default and persistence are therefore not
specified as requirements. If volume becomes a persisted setting, add it to
`SettingsConfig` with a default and extend this spec.
