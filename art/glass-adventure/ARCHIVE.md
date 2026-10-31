# art/glass-adventure archive

On 2026-10-31 this folder dropped 1,080 Git LFS files (6,182.5 MB) from HEAD: proofs, rejected and
superseded versions, raw scans that no kept asset names, the audio/v1 masters and duplicate copies.
376 LFS files (3,037.8 MB) stay, and so does every regular-git file: receipts, manifests, scripts and
notes.

[ARCHIVE.csv](ARCHIVE.csv) has one row for each of the 1,456 LFS files that were here before the cut:
path, oid, size, last commit, decision, category, family and reason.

## What stays

1. **runtime-cited** (63 files): every art file that a runtime manifest under
   `apps/beside-cue/public/games` cites. 60 are sources of live runtime files and 3 are cited only by
   retired ones.
2. **pr1275-copy** (4 more files): the art copy of each runtime file that PR #1275 retires or
   re-encodes, so the original bytes stay at HEAD. Two other copies already count under rule 1.
3. **newest-source** (232 files): for each art family, the newest version's sources (packed .blend,
   master or accepted .glb, key textures) and the inputs its own receipts name. journey-map/v10 keeps
   the baked camellia .blend and drops its dense intermediates (owner call).
4. **unclear-keep** (77 files): files that no approved removal category clearly fits, or that a repo
   document says stay. The reason column says which.

| Family                        | Version kept       | What is kept                                                                                |
| ----------------------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| Cloudway Marble               | v7                 | v7 blend and 2K textures, the v4 Meshy dense donor and maps the v7 build reads, guide       |
| Cloudway Frost and Glide      | v6                 | v6 blends, 4K masters, 2K delivery, textures, the v5 dense donors and maps, guides          |
| Cloudway Crackle              | v3                 | the v3 runtime GLB; Crackle geometry is procedural (platform-trials/v2 script)              |
| Cloudway concepts             | platform-trials/v1 | the three concept images                                                                    |
| Cloudway laboratory           | v1                 | catalogue previews (unclear-keep)                                                           |
| Museum map kit                | journey-map/v2     | map kit .blend and the runtime GLB copy; journey-map/v1 concept A                           |
| Museum sculpture kit          | journey-map/v3     | concept guides, the temple and cypress scans v9 reads, the retired runtime kit              |
| Museum twin finish kit        | journey-map/v9     | three blends, kit and candidate GLBs, bake textures; the v4 kit GLB v9 reads                |
| Museum camellia botanical     | journey-map/v10    | baked blend, valid rebaked GLB, 2K maps, guide                                              |
| Museum twin connector         | journey-map/v7     | candidate blend and GLB, retextured remesh, raw scan, guide                                 |
| Museum architecture kit       | journey-map/v8     | blends, conservatory GLB, bake textures, raw scan, guide; the v7 kit GLB v8 reads           |
| Mystery muse painting         | journey-map/v5     | the painting                                                                                |
| Adventure v2                  | v2                 | references, CC0 PBR sources (unclear-keep), models                                          |
| Adventure v3 vessels          | v3                 | finalized and ready-intact blends, Meshy donors, accepted face labels                       |
| Adventure v3 and v4 buildings | v3, v4             | final and imported blends, exports, atlases, raw donors                                     |
| Adventure v5 decor            | v5                 | final and imported blends, Meshy donors, concepts, paintings                                |
| Adventure v6 level 2          | v6, celadon v4     | cavity and fracture sources, harp final-v2, the celadon v4 set, donors, concepts, paintings |
| Conservatory paintings        | v7-conservatory    | the two painting masters                                                                    |
| Soundtrack                    | audio/v1           | loop FLACs (unclear-keep); the masters are archived                                         |
| Merc voice                    | D2                 | v1 D2 takes, v1 auditions B and C (unclear-keep), v4 reactions, v5 encores, v6 phrases      |

## What went

| Category                                                            | Files |      MB |
| ------------------------------------------------------------------- | ----: | ------: |
| proof: proofs folders, review renders, review scenes                |   670 | 1,764.3 |
| raw: Meshy or donor scans and donor stages that no kept asset names |   208 | 1,832.7 |
| superseded: older versions and intermediates                        |    73 | 1,186.8 |
| rejected: rejected or unselected variants                           |    84 |   948.8 |
| duplicate: same oid as a path that stays                            |    35 |   292.8 |
| audio-master: audio/v1 masters                                      |    10 |   157.0 |
| Total                                                               | 1,080 | 6,182.5 |

The `.gitattributes` rules that matched only removed files went with them: 18 files deleted, 9 edited,
45 rules in all.

Removing a file from HEAD does not delete its LFS object. History still points at every one, so the
LFS storage that GitHub bills stays the same.

## Restore a file

From git history:

```bash
c=$(git log --diff-filter=A --format=%H -1 -- art/glass-adventure/ARCHIVE.csv)
git checkout "$c~1" -- <path>
git check-attr filter -- <path>   # must print "filter: lfs"
git lfs pull --include="<path>"
```

The `last_commit_sha` column works in place of `$c~1`. If `check-attr` prints `unspecified`, the rule
that covered the file went in this cut. Bring back that folder's `.gitattributes` with
`git checkout "$c~1" -- <folder>/.gitattributes`, or run `git lfs track "<path>"`, then pull. Without a
rule, git leaves the small pointer file in place and `git lfs pull` skips it. The pull downloads from
GitHub and uses LFS bandwidth.

From the local archive: every removed file sits at its original path under
`/run/media/maff/Game_Shared/agent-out-live/mercurypitch/2026-10-31/9dec546910d1465591542c72c864626b/deliverables/art-archive`, with ARCHIVE.csv at its root. On 2026-10-31 all 1,080 archived files (6,182,506,529 bytes) were read back and each sha256 matched its oid, with 0 mismatches. A second pass, with each file's cached pages dropped first, matched too.

## Rebuild scripts

The production scripts stay in git, but many of them read or write files that are archived now. For
example, `journey-map/v10/production` reads `baked/camellia-crescent-rebaked.glb`, the journey-map v7
to v9 builds read remesh and dense-bake intermediates, the platform-trials v2 and v3 builds read the
old kit exports, and the v3 vessel trial scripts read donor-stage blends. Restore the files a script
names before you run it.
