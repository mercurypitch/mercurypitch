# Cloudway V6 real-game proof

These captures come from the passing dedicated Chromium `@smoke` run against
the exact public combined kit. The browser used the real Beside Cue WebGL2 game,
the repository Three 0.185.1 loader, the current crescent route, its 9–14 m sky
fog, and keyboard movement. No renderer or simulation fixture supplied the
images.

| Capture                                                                        | SHA-256                                                            | Evidence                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| [`cloudway-v6-route-overview.png`](cloudway-v6-route-overview.png)             | `4fea82a01eaef88b5b60771df4dcd504aecd781ba4633c7d469bf4743f7eba51` | Whole-route scale, fog and landing readability                 |
| [`cloudway-v6-frost-gameplay-close.png`](cloudway-v6-frost-gameplay-close.png) | `7bbc7d96c347f277e9e8aa5a901c523ced6eb5e0bf5ca98c4d20f38164b570bd` | Merc grounded on the cyan Frost delivery after a keyboard jump |
| [`cloudway-v6-frost-recovery.png`](cloudway-v6-frost-recovery.png)             | `919b1de8e1dd47fe4df0076128b8e7ab3b34bef2a1f70f2c13e0715f6d64ad1a` | Safe Frost rest and checkpoint recovery sightline              |
| [`cloudway-v6-glide-gameplay-close.png`](cloudway-v6-glide-gameplay-close.png) | `9ae57269b59c75048bf470d7f53d02b7cf3ed331982653bacf29bbd6e3b2116b` | Merc grounded on the moving emerald Glide delivery             |
| [`cloudway-v6-glide-crossed.png`](cloudway-v6-glide-crossed.png)               | `f53b420133983fc8532b8f353b7ed8bb9f51e1ba2365a495fa533eb0ea4ef5f4` | East-rest landing after the 1.9 m ride and 0.55 m exit jump    |

The matching browser spec verifies the served GLB hash, observes actual
`drawElementsInstanced` calls, requires airborne-to-grounded contact on both V6
surface families, and checks the plain `GLTFLoader` root, collider and PBR-map
contracts. Structural and Khronos results are recorded beside these images in
[`cloudway-platform-kit-v6-audit.json`](cloudway-platform-kit-v6-audit.json) and
[`cloudway-platform-kit-v6-validator.txt`](cloudway-platform-kit-v6-validator.txt).
