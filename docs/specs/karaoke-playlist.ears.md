# Karaoke Playlist — EARS Requirements

Requirements for the karaoke playlist store (`src/stores/karaoke-playlist-store.ts`),
written in EARS (Easy Approach to Requirements Syntax). Each requirement has an
ID referenced by the unit tests in:

- `src/tests/karaoke-playlist-store.test.ts` (queue building — `QUEUE-*`)
- `src/tests/karaoke-playlist-store.transport.test.ts` (CRUD + transport)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Playlist management — `CRUD-*`

- **CRUD-1** — WHEN a playlist is created with a name, the system shall persist it with an empty item list.
- **CRUD-2** — WHEN a playlist is renamed, the system shall update its stored name.
- **CRUD-3** — WHEN a playlist is deleted, the system shall remove it from the store.
- **CRUD-4** — WHEN an item is added to a playlist, the system shall append it with a generated unique id.
- **CRUD-5** — WHEN an item is removed, the system shall drop only that item.
- **CRUD-6** — WHEN an item is reordered, the system shall move it to the target index, preserving the others' relative order.
- **CRUD-7** — IF a reorder index is out of range, THEN the system shall leave the order unchanged.
- **CRUD-8** — WHEN a singer name is set on an item, the system shall store the trimmed value, and clear it when blank.
- **CRUD-9** — WHEN shuffle-within-group is toggled on a group item, the system shall persist the flag.
- **CRUD-10** — WHEN the playlist shuffle-order flag is set, the system shall persist it.
- **CRUD-11** — WHEN the playlist play-mode is set, the system shall persist it.
- **CRUD-12** — WHEN a playlist is created with a full item set (import), the system shall persist every item with a new id and retain the given shuffle-order and play-mode.

## Queue building — `QUEUE-*`

- **QUEUE-1** — The system shall expand a group item into its member sessions in order.
- **QUEUE-2** — The system shall contribute exactly one queue entry per standalone session item.
- **QUEUE-3** — The system shall preserve item order across mixed session and group items.
- **QUEUE-4** — IF a session's title is unknown, THEN the system shall use "Unknown".
- **QUEUE-5** — WHERE shuffle-within-group is set, the system shall randomise a group's member order while preserving its set.
- **QUEUE-6** — WHERE shuffle-order is set, the system shall randomise the top-level order while preserving the full set.
- **QUEUE-7** — WHERE play-mode is round-robin, the system shall emit one song per group per round until every song is played.
- **QUEUE-8** — WHERE play-mode is round-robin, the system shall treat a standalone session as a one-song group.
- **QUEUE-9** — WHERE play-mode is round-robin, the system shall play every song exactly once.

## Playback transport — `XPORT-*`

- **XPORT-1** — WHEN a playlist with at least one playable song is started, the system shall build the queue, set the current index to 0, and enter the `ready` state.
- **XPORT-2** — IF a started playlist expands to no playable songs, THEN the system shall remain `idle`.
- **XPORT-3** — WHILE `ready`, WHEN the countdown begins, the system shall enter `countdown`.
- **XPORT-4** — WHEN the current song begins, the system shall enter `playing`.
- **XPORT-5** — WHEN advancing before the last song, the system shall move to the next index and enter `ready`.
- **XPORT-6** — WHEN advancing on the last song, the system shall enter `summary`.
- **XPORT-7** — WHEN moving to the previous song, the system shall move back one index and enter `ready`.
- **XPORT-8** — IF moving to the previous song on the first song, THEN the system shall stay on the first song.
- **XPORT-9** — WHEN a non-null song score is reported, the system shall record it at the current index and enter `scoring`.
- **XPORT-10** — IF a reported score is null, THEN the system shall leave the recorded score unchanged while still entering `scoring`.
- **XPORT-11** — WHEN the playlist is restarted, the system shall reset to index 0, clear recorded scores, and enter `ready`.
- **XPORT-12** — WHEN the playlist is stopped, the system shall clear the queue and return to `idle`.
- **XPORT-13** — The system shall report the playlist as active whenever it is not `idle`.
- **XPORT-14** — The system shall expose the current song and the next song from the queue at the current index.
- **XPORT-15** — IF the active playlist is deleted, THEN the system shall stop playback.

## Export / import round-trip — `IMPORT-*`

Verified in `src/tests/karaoke-playlist-import.test.ts`.

- **IMPORT-1** — WHEN a karaoke playlist is exported and re-imported, the system shall recreate every referenced session under a new id, preserving its song title.
- **IMPORT-2** — WHEN a karaoke playlist is re-imported, the system shall recreate the referenced groups, remapping their membership to the new session ids.
- **IMPORT-3** — WHEN a karaoke playlist is re-imported, the system shall recreate the playlist with its item order, singers, shuffle-order and play-mode, remapping each group/session reference to the new id.
