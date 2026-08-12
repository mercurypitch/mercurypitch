# Phone → TV song handoff via QR code

**Tracked in issue #489.** Deferred from PR #488 (TV/low-tier work). Future
work — kept beside [device-sync.md](device-sync.md) because the two compose:
this is the no-account, one-song, standing-in-the-living-room path; account
sync is the everything-everywhere path. Neither blocks the other.

## The problem

A TV browser has no file manager, so songs cannot be uploaded there. Today the
Karaoke upload view detects this and tells the user to prepare songs elsewhere
(`src/components/UvrPanel.tsx`, gated on `isTvDevice()`). The QR handoff
replaces that dead end with: TV shows a code, phone scans it, phone sends the
song straight to the TV.

## Key insight: the transport already exists — do NOT build a new one

The jam room's peer-to-peer stem transfer is complete and shipped. Reuse it.
The QR code is ONLY the pairing step (getting the phone into the TV's room).

- `src/stores/jam-store.ts` — `createJamRoom(...)` (TV creates the room),
  `shareJamSongWithRoom(onlyMissing = false)` (phone sends),
  `applyReceivedStem(...)` (TV receives), `songIsPlayableHere(...)`,
  `reportSongHave()`
- `src/lib/jam/jam-song-share.ts` — `encodeStemsForShare`, `shareStemsWithPeers`
- `src/lib/jam/jam-song-transfer.ts` — `TransferReceiver`, chunking, sha256
  integrity
- `src/lib/jam/jam-song-sources.ts` — `songPlayableInRoom()` already returns
  `needsShare: true` for a local song when peers are present. That is this flow.

## What the QR encodes

The existing jam deep link — nothing new:

```
${window.location.origin}/#/jam:${roomId}
```

- The route already parses: `src/lib/hash-router.ts`, `/^\/jam:(.+)$/`
- The exact string is already built in
  `src/components/jam/JamInviteModal.tsx` (`roomLink()`) and in `JamPanel.tsx`.
  Reuse, don't re-derive.

## Flow to implement

1. On the TV, the user opens the handoff entry point (see below).
2. TV creates (or rejoins) a jam room and displays the QR for its room link.
3. Phone scans with its native camera app → opens `/#/jam:ROOMID` → joins.
4. On the phone, the user picks a song from their library and sends it with the
   existing share control (`JamSongShare` → `shareJamSongWithRoom`).
5. TV receives via the existing transfer path and the song is playable there.

## Where the UI goes

- **Primary**: `src/components/jam/JamInviteModal.tsx` — it already shows the
  room code and the link. Add the QR beside them. Benefits every device, not
  just TVs.
- **TV entry point**: the `isTvDevice()` notice in `src/components/UvrPanel.tsx`
  currently only says "prepare songs elsewhere". Give it an action that opens
  the handoff. Keep the existing copy as the fallback path.
- TV detection: `isTvDevice()` from `@/lib/device-tier`.

## QR rendering — recommendations

- **No runtime QR library exists in this repo.** `vite-plugin-qrcode` in
  package.json is a **devDependency** that prints the dev-server URL in the
  terminal — it cannot render at runtime. Add a small runtime dep or generate
  the matrix yourself.
- **Render as inline SVG, not canvas.** Canvas here would pull in the repo's
  DPR/`renderScale()`/`canvas-size-sync` rules for a static image that gains
  nothing from them; SVG stays crisp at any TV scale with none of that.
- **If you add a dependency**, give it its OWN chunk name in `vite.config.ts`
  `manualChunks` and load it with `await import()`. See the MISTAKES.md entry
  "A `manualChunks` group erases the `await import()` it contains" — a shared
  chunk name silently makes it a static first-paint dependency of every entry.
  Verify with `ANALYZE=1 pnpm build` then `grep <chunk> dist/*.html` — absent
  from every entry HTML is the only proof.

## TV-specific UX requirements

- Big: a TV is viewed from ~3m. Target at least ~30–40% of viewport height.
- Always render dark-on-light with a proper quiet zone, even in dark theme —
  inverted QR codes fail on many phone scanners. Don't inherit theme colors.
- D-pad navigable: no hover-only affordances, visible focus rings, reachable
  with arrow keys + OK. There is no touch and no pointer on a TV.
- Show the room code as text under the QR as a manual fallback.

## Verification

- `pnpm check` (typecheck + lint + format) — required.
- Unit-test the pure parts (link building, QR matrix if hand-rolled).
- The `jam-two-peer` skill drives two real WebRTC peers locally and is the
  right harness for the end-to-end handoff — see `.claude/skills/jam-two-peer/`.
  Note its gotchas: build to plain HTTP, run wrangler FROM `workers/jam-worker`,
  pass `--var ALLOWED_ORIGINS:http://localhost:3001`, and use two separate
  browser INSTANCES (not contexts) or the peer connection never establishes.
- Headless preview lies in known ways (welcome overlay blocks the page,
  `requestAnimationFrame` is paused) — see MISTAKES.md before concluding
  something is broken.
- If the UI adds a feature to a page with a tour, tour coverage rules apply
  (AGENTS.md) — add/adjust steps in the same PR.

## Scope boundaries

- Do NOT build a new transfer protocol, signaling path, or cloud upload.
- Do NOT make this depend on accounts or device-sync — the point is that it
  works locally, peer to peer, with no sign-in.
- The song-sharing-by-account work stream is separate; this should compose with
  it later, not block on it. Once device-sync's account list exists, the same
  QR pairing can also offer "your account's songs" on the TV — see
  [device-sync.md](device-sync.md), decision D11.
