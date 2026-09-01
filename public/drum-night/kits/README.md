# Drum Night kit assets

These are optional, gesture-loaded one-shot banks. Every sampled resource has
an audited MP3 compatibility object and a deterministic Ogg Opus sibling. The
player proves Opus with its real Web Audio decode path and then pins one format
for the whole selected-kit plan; it never mixes codecs per hit. Assets are not
precached by the service worker and are safe to move behind a configured media
origin while their content-hashed object keys remain unchanged.

`catalog.json` is the machine-readable byte, hash, articulation, and pinned
source-provenance companion. Licence identity is declared in the app-owned kit
manifest and the `LICENSE.md` / `NOTICE` files inside each sampled-kit folder.
`publish-plan.json` is inert metadata for a later, reviewed Cloudflare R2
upload; it does not contain credentials or execute a deployment.

Rebuild and verify from the repository root:

```sh
node scripts/curate-drum-night-kits.mjs
node scripts/curate-drum-night-kits.mjs --check
node scripts/curate-drum-night-kits.mjs --publish-plan
node scripts/encode-drum-kit-formats.mjs --check
```

The canonical curator rebuilds MP3 and Opus together. For a format-only refresh
of already audited MP3 bytes, run `node scripts/encode-drum-kit-formats.mjs`.
Both paths require the pinned FFmpeg version recorded in the generated
catalogue; `--check` re-encodes every Opus object and verifies byte-for-byte
hash and publish closure.

Mercury Synth and Circuit have no downloadable assets. Mercury's recipes live
in `src/lib/drum-voices.ts` and remain the only per-hit fallback for sampled
flavors; Circuit is used only when explicitly selected. FLAC is accepted by the
catalogue schema but is not selected by the runtime until a separate delivery
and entitlement decision is implemented.
