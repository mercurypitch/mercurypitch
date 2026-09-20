# Glassworks asset storage

The playable exports under `apps/beside-cue/public/games/` are ordinary Git
files. Building, testing and playing the game does not require the authoring
archive. CI deliberately leaves source-art LFS pointers unexpanded.

The `v2`, `v3`, `v4`, `audio` and `voice` authoring directories use Git LFS for large
binary sources: image masters, Meshy originals, editable Blender projects,
fracture and material trials, review images, source WAVs and audio derivatives.
Scripts, prompts, manifests and receipts remain readable in Git. Historical
paths in receipts identify the original workstation; resolve their suffix
relative to this repository when restoring elsewhere.

Install Git LFS, then fetch only the authoring collection you need:

```sh
git lfs install
git lfs pull --include="art/glass-adventure/v3/**"
```

Fetch the complete source archive with:

```sh
git lfs pull --include="art/glass-adventure/**"
git lfs fsck
```

For a lightweight clone, use `GIT_LFS_SKIP_SMUDGE=1 git clone` followed by the
repository URL, then use the selective pull above when authoring. Do not enable
automatic LFS download in every CI checkout: the game consumes the separate
public exports. Source edits should retain their original donors and receipts;
new versions consume additional LFS storage and downloads consume bandwidth.

`source-archive.json` records the byte sizes and SHA-256 hashes of this wave's
binary files. Provider receipts and generated audit JSON retain their original
formatting so provenance remains reproducible. Blender `.blend1` backups,
interrupted `.incomplete` downloads and Python caches stay local; they are not
the source of truth.

## Collections

- `v2`: image prompts/masters, CC0 PBR provenance, Meshy provider archives and
  the first textured Blender kits.
- `v3`: finalized vessels with matching closed fragments, finalized architecture,
  editable donors, recipes and inspection evidence. Accepted exports are copied
  into the playable `adventure-v3` directory.
- `audio/v1`: original WAV masters, the listening review and approved runtime
  loop derivation. M01 and M03 are integrated; M02 is excluded from this level.
- `v4`: window/screen modules, the enclosed-museum study, and verified playable
  derivatives under `adventure-v4`. The original packed Blender projects and
  Meshy donors remain intact; `architecture/export_playable.py` reproduces the
  smaller exports and reports their source hashes.
- `voice/v1`: twelve original Merc voice-design previews, four principal
  audition reels, isolated lines, exact scripts/settings, hashes and a browser
  listening page. D Gentle Whimsical is the current owner favorite. No candidate is activated in the game until the owner makes the final choice.
- `voice/v2`: nine additional raw previews and three close variations on D, with
  audition reels, isolated lines, exact prompts/settings and audit records.
  The second listening page compares unchanged D2 with E1/F1/G1.

Device performance and owner acceptance of the enclosed route remain separate
from the archived source and automated verification records.

Merc's final first voice is original D2 Gentle Whimsical. `voice/v3` preserves
selection and the verified ElevenLabs enrollment; `voice/RUNTIME.md` documents
the three exact approved clips used by the game and their lifecycle policy.
No old audition or lossless original was removed.
