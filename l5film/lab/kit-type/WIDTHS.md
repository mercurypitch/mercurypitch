# Real widths and clearances (LAB-CHECKS lines 4 to 15 and 21)

Measured in Chromium with the film's own fonts (assets/fonts, as fonts.css.txt loads them) by
`lab/kit-src/probe.mjs` running `window.__kitWidths()` in `lab/kit-src/type.html`: canvas text metrics,
so "ink" is the glyphs' own extent (descenders and side bearings included), and "advance" is the width
`text-anchor` aligns (JetBrains Mono's trailing .18em left out, as L.tag sets it). World labels are
measured at F0 and mapped through the framing a line names. Re-run after any type change:
`$S/bin/heavy node lab/kit-src/probe.mjs type`.

## Clearances under 12 px

| Line | What | Measured | Needs | Board | Pass | Note |
| - | - | - | - | - | - | - |
| 9 | the second pill's check (22 px, centred 20 px left of the capsule) from the first pill (930) | 9.0 | 12.0 | 9.0 | **no** | the board's own gap (40 px between the capsules): unchanged, 9 px; centring both 468 px capsules would make it 5 |
| 9 | the second pill's check from its own capsule (970) | 9.0 | 12.0 | 9.0 | **no** | the board's place: 9 px |
| 11 | the gauge chip from the frame's strokes (right 1630 vs 1640; top 300 vs 290) | 9.0 | 9.0 | 9.0 | yes | 10 px to the strokes' centres (1640, 290), 9 to their inner edges (1639, 291): the lead's place |
| 13 | strip chip (130 to 170) from row 1's envelope (180) | 10.0 | 10.0 | 10.0 | yes | heights only |
| 13 | LISTEN ONLY (330 to 370) from rows 1 and 2 (320, 380) | 10.0 | 10.0 | 10.0 | yes | heights only |

## Every clearance

| Line | What | Measured (screen px) | Needs | Board | Pass | Note |
| - | - | - | - | - | - | - |
| 4 | "louder" off the swollen strip's fill (top 593) | 17.0 | 12.0 | 18.0 | yes |  |
| 4 | "louder" from its branch (1010, 525) to (960, 582) | 37.6 | 12.0 | 40.0 | yes |  |
| 4 | "higher" under the band's foot (456.5) | 14.5 | 12.0 | 14.0 | yes |  |
| 4 | "higher" from its branch (1010, 525) to (960, 375) | 64.8 | 12.0 | 66.0 | yes |  |
| 4 | the stem (from (915, 720), the lead's answer 5; 30 degrees up and right) right of "50" | 12.2 | 12.0 | 12.0 | yes | "50" at 0.78: x 888.8 to 916.6, y 687.1 to 705.1; from (914, 717) it was 9.1 |
| 5 | "can’t push air out" (30 px) starts at or right of screen x 0 | 64.3 | 0.0 | 24.0 | yes |  |
| 5 | "can’t push air out" from "diaphragm" (36 px assumed) | 27.3 | 12.0 | 29.0 | yes |  |
| 6 | "knees unlocked" left of the back arrow's stroke (x 923.5) | 17.7 | 16.0 | 16.0 | yes |  |
| 7 | “support” descenders over the top of Merc's line's stroke at 32.87 | 19.5 | 12.0 | 12.0 | yes | line y 460.2 at s 0.8204 (sine.inOut, pull 31.40 to 34.40), stroke 4 world px; descender foot 439.0 |
| 8 | "less holding back at first" from "more adding as the air runs low" | 142.1 | 12.0 | 12.0 | yes |  |
| 8 | "what the note needs" (Loud) over the gold line (454, 3 px) | 12.1 | 12.0 | 12.0 | yes |  |
| 8 | "Quiet" and "Loud" chips apart (38 high, centred 320 and 372) | 14.7 | 12.0 | 14.7 | yes | height-only, no width in it |
| 8 | the chips from the frame stroke's outer edge (1641; chips from 1653, the lead's answer 5) | 12.6 | 12.0 | 12.0 | yes | at F-gauge (1.05); from 1652 it was 11.6 |
| 8 | "Quiet" chip's right end on screen (inside 1920) | 135.7 | 0.0 | 0.0 | yes | chip x 1675.7 to 1784.3 |
| 9 | ILLUSTRATION to LISTEN ONLY at F-cold end (0.92) | 14.7 | 12.0 | 14.7 | yes | right-aligned 1520 and left-aligned 1536: no width in it |
| 9 | ILLUSTRATION to LISTEN ONLY at 0.78 | 12.5 | 12.0 | 12.5 | yes |  |
| 9 | the chip under the second pill at 31.20 (pill foot 134) | 12.4 | 12.0 | 12.0 | yes |  |
| 9 | "loud ≠ high" under LISTEN ONLY at 0.78 (to y 223.8) | 18.2 | 12.0 | 19.0 | yes | x 1514.3 to 1741.7 |
| 9 | pill 2: each pad, its text centred in the fixed 460 px capsule | 24.6 | 12.0 | 24.0 | yes | text 410.7 px; L.pill centres the text when x1 is fixed |
| 9 | pill 1: each pad, its text centred in its 468 px capsule (x 462 to 930, DECISIONS 146) | 24.3 | 12.0 | 24.0 | yes | text 419.4 px; at 460 px its pads were 20.3 |
| 9 | the second pill's check (22 px, centred 20 px left of the capsule) from the first pill (930) | 9.0 | 12.0 | 9.0 | **no** | the board's own gap (40 px between the capsules): unchanged, 9 px; centring both 468 px capsules would make it 5 |
| 9 | the second pill's check from its own capsule (970) | 9.0 | 12.0 | 9.0 | **no** | the board's place: 9 px |
| 10 | the definition (baseline 200) under the chip's foot (160) | 15.0 | 12.0 | 15.0 | yes | x 401.0 to 1283.1 |
| 10 | the four words' outlines (to 106) over the chip (from 120) | 14.0 | 12.0 | 14.0 | yes |  |
| 11 | the band's foot (and its 2 px edge) over the gauge chip while over it | 56.7 | 12.0 | 12.0 | yes | L.GAUGE.split sampled every 0.001 |
| 11 | the gauge chip from the frame's strokes (right 1630 vs 1640; top 300 vs 290) | 9.0 | 9.0 | 9.0 | yes | 10 px to the strokes' centres (1640, 290), 9 to their inner edges (1639, 291): the lead's place |
| 13 | strip chip (130 to 170) from row 1's envelope (180) | 10.0 | 10.0 | 10.0 | yes | heights only |
| 13 | LISTEN ONLY (330 to 370) from rows 1 and 2 (320, 380) | 10.0 | 10.0 | 10.0 | yes | heights only |
| 14 | "SLOWED · ILLUSTRATION" (from x 1110) clears "settled" | 541.9 | 12.0 | 55.0 | yes | "settled" at CU-scoop x 427.8 to 568.1 |
| 15 | "Your turn." from the frame (screen x 928 at F-turn) | 265.3 | 12.0 | 35.0 | yes | x 266.0 to 662.7, y 120.0 to 201.0; Merc's arcs need m-blue at 300 |
| 15 | "Your turn." from the ring (1376 - 231) | 482.3 | 12.0 | 12.0 | yes |  |

## Real widths (line 21)

| Group | Label | Font | Advance | Ink x | Ink y (at its baseline) |
| - | - | - | - | - | - |
| band chart (world, F0) | A3 | outfit 600 48 | 60.7 | 305.3 to 364.6 | 383.0 to 418.0 |
| band chart (world, F0) | in the band | outfit 600 30 | 150.5 | 216.5 to 364.4 | 448.0 to 471.0 |
| band chart (world, F0) | level | outfit 600 32 | 66.4 | 401.0 to 465.5 | 754.0 to 779.0 |
| band chart (world, F0) | in the band: within 35 cents (Lesson 3) | outfit 500 34 | 561.8 | 401.0 to 960.6 | 124.0 to 155.0 |
| band chart (world, F0) | pressure: how hard your breath pushes on your vocal folds | outfit 600 34 | 883.1 | 401.0 to 1283.1 | 175.0 to 207.0 |
| band chart (world, F0) | ? | outfit 600 64 | 32.2 | 1537.0 to 1566.0 | 376.0 to 424.0 |
| band chart (world, F0) | sung easily | outfit 600 36 | 176.5 | 1536.0 to 1712.5 | 443.0 to 478.0 |
| band chart (world, F0) | above the band | outfit 600 36 | 251.6 | 1536.0 to 1786.4 | 235.0 to 263.0 |
| band chart (world, F0) | above the band | outfit 600 36 | 251.6 | 1536.0 to 1786.4 | 273.0 to 301.0 |
| band chart (world, F0) | louder · higher | outfit 600 56 | 357.7 | 423.0 to 777.4 | 227.0 to 280.0 |
| band chart (world, F0) | also: a little higher | outfit 600 36 | 295.2 | 420.0 to 715.5 | 283.0 to 318.0 |
| band chart (world, F0) | mainly: louder | outfit 600 36 | 230.7 | 422.0 to 651.0 | 573.0 to 608.0 |
| band chart (world, F0) | Both lines are drawings of that rule, not recordings. | inter 400 34 | 744.8 | 777.2 to 1518.5 | 787.0 to 820.0 |
| band chart (world, F0) | A, any octave | outfit 600 30 | 183.9 | 400.0 to 583.6 | 268.0 to 297.0 |
| band chart (world, F0) | in the band | outfit 600 30 | 150.5 | 641.0 to 788.9 | 268.0 to 291.0 |
| band chart (world, F0) | steady: settles into the band and stays | outfit 600 30 | 512.2 | 400.0 to 911.9 | 218.0 to 247.0 |
| band chart (world, F0) | steady air keeps it there? | outfit 600 40 | 452.4 | 400.0 to 851.2 | 160.0 to 199.0 |
| band chart (world, F0) | scoop | outfit 600 30 | 79.5 | 360.2 to 439.1 | 485.0 to 507.0 |
| band chart (world, F0) | small vibrato: inside the band | outfit 600 30 | 396.0 | 960.0 to 1354.3 | 320.0 to 343.0 |
| band chart (world, F0) | a comfortable, fixed length | outfit 600 30 | 366.7 | 776.6 to 1142.5 | 555.0 to 584.0 |
| gauge (world, F0) | A3 | outfit 600 36 | 45.5 | 694.5 to 739.2 | 186.0 to 213.0 |
| gauge (world, F0) | the note: unchanged | outfit 600 30 | 276.1 | 760.0 to 1034.4 | 118.0 to 147.0 |
| gauge (world, F0) | push of air (not pitch) | outfit 600 30 | 285.9 | 791.0 to 1075.8 | 252.0 to 282.0 |
| gauge (world, F0) | one 10-second note | outfit 500 30 | 259.6 | 760.0 to 1019.5 | 738.0 to 761.0 |
| gauge (world, F0) | the lungs' own push | outfit 600 30 | 260.2 | 776.0 to 1035.3 | 303.0 to 332.0 |
| gauge (world, F0) | what the note needs | outfit 600 30 | 272.9 | 776.0 to 1048.6 | 618.0 to 641.0 |
| gauge (world, F0) | what the note needs | outfit 600 30 | 272.9 | 1357.1 to 1629.7 | 418.0 to 441.0 |
| gauge (world, F0) | held back | outfit 600 34 | 147.2 | 787.4 to 933.6 | 515.0 to 541.0 |
| gauge (world, F0) | added | outfit 600 30 | 86.8 | 1516.6 to 1601.8 | 623.0 to 646.0 |
| gauge (world, F0) | Now: holding back | outfit 600 34 | 281.4 | 1360.6 to 1640.0 | 250.0 to 283.0 |
| gauge (world, F0) | Now: adding | outfit 600 34 | 193.2 | 1448.8 to 1638.3 | 250.0 to 283.0 |
| gauge (world, F0) | less holding back at first | outfit 600 30 | 325.1 | 761.0 to 1085.5 | 743.0 to 772.0 |
| gauge (world, F0) | more adding as the air runs low | outfit 600 30 | 420.6 | 1220.4 to 1639.9 | 783.0 to 812.0 |
| gauge chips (world) | Quiet | outfit 600 30 | 75.4 | 1668.0 to 1742.8 | 308.0 to 332.0 |
| gauge chips (world) | Loud | outfit 600 30 | 66.9 | 1669.0 to 1732.2 | 360.0 to 383.0 |
| tags (mono 500 26, .18em) | ILLUSTRATION | mono 500 26 | 238.7 | 2.0 to 237.1 | -20.0 to 1.0 |
| tags (mono 500 26, .18em) | LISTEN ONLY | mono 500 26 | 218.4 | 2.0 to 217.8 | -20.0 to 1.0 |
| tags (mono 500 26, .18em) | SLOWED · ILLUSTRATION | mono 500 26 | 421.2 | 1.0 to 419.6 | -20.0 to 1.0 |
| pills (frame-fixed) | Settle, steadier than before | outfit 600 34 | 419.4 | 494.0 to 913.0 | 95.0 to 126.0 |
| pills (frame-fixed) | Get louder and drift higher | outfit 600 34 | 410.7 | 995.0 to 1405.0 | 95.0 to 128.0 |
| four words (chips, frame-fixed) | air pressure | outfit 600 30 | 160.7 | 0.0 to 160.4 | -22.0 to 7.0 |
| four words (chips, frame-fixed) | diaphragm | outfit 600 30 | 150.3 | 0.0 to 149.3 | -22.0 to 7.0 |
| four words (chips, frame-fixed) | onset | outfit 600 30 | 74.8 | 0.0 to 75.1 | -21.0 to 1.0 |
| four words (chips, frame-fixed) | “support” | outfit 600 30 | 133.6 | 1.0 to 132.5 | -22.0 to 7.0 |
| turn (frame-fixed) | Your turn. | serif italic 400 110 | 413.8 | 266.0 to 662.7 | 120.0 to 201.0 |
| turn (frame-fixed) | Sore, hoarse or unwell today? | outfit 700 36 | 485.6 | 310.0 to 794.6 | 235.0 to 270.0 |
| turn (frame-fixed) | Just listen along. | outfit 700 36 | 276.7 | 310.0 to 584.9 | 279.0 to 314.0 |
| turn (frame-fixed) | hurts or uncomfortable · unusually hoarse or tired | outfit 500 30 | 650.1 | 311.0 to 958.7 | 330.0 to 358.0 |
| turn (frame-fixed) | usual notes suddenly gone · ill | outfit 500 30 | 381.4 | 311.0 to 690.4 | 368.0 to 397.0 |
| turn (frame-fixed) | talking or singing is hard work | outfit 500 30 | 394.7 | 310.0 to 705.4 | 406.0 to 435.0 |
| turn (frame-fixed) | listening along: rest your voice and watch the ring | outfit 500 30 | 653.3 | 261.0 to 912.1 | 464.0 to 493.0 |
| turn (frame-fixed) | Stop immediately if anything | outfit 600 36 | 468.0 | 260.0 to 726.2 | 521.0 to 556.0 |
| turn (frame-fixed) | feels uncomfortable. | outfit 600 36 | 337.9 | 260.0 to 596.3 | 563.0 to 591.0 |
| turn (frame-fixed) | Nothing listens | outfit 600 30 | 200.5 | 1002.0 to 1200.1 | 380.0 to 409.0 |
| turn (frame-fixed) | Breathe in, low and quiet | outfit 600 28 | 311.3 | 1330.7 to 1640.1 | 381.0 to 408.0 |
| turn (frame-fixed) | A3 · Merc | outfit 600 30 | 123.1 | 1016.0 to 1139.4 | 340.0 to 363.0 |
| turn (frame-fixed) | A4 · Tavi, an octave up | outfit 600 30 | 298.2 | 1202.0 to 1499.5 | 340.0 to 369.0 |
| turn (frame-fixed) | How did that feel? | serif italic 400 64 | 404.7 | 997.0 to 1406.8 | 431.0 to 481.0 |
| turn feel capsules (x 1000 to 1230) | Easy | outfit 600 30 | 64.6 | 1016.0 to 1078.8 | -22.0 to 7.0 |
| turn feel capsules (x 1000 to 1230) | Workable | outfit 600 30 | 131.4 | 1014.0 to 1145.2 | -22.0 to 1.0 |
| turn feel capsules (x 1000 to 1230) | Effortful | outfit 600 30 | 115.7 | 1016.0 to 1128.3 | -22.0 to 1.0 |
| turn feel capsules (x 1000 to 1230) | Uncomfortable | outfit 600 30 | 206.9 | 1015.0 to 1220.6 | -22.0 to 1.0 |
| recap Voice Mirror card | Voice Mirror has you glide up and down, | outfit 600 34 | 602.9 | 326.0 to 927.4 | 315.0 to 348.0 |
| recap Voice Mirror card | hold any comfortable note for six seconds, | outfit 600 34 | 646.3 | 327.0 to 970.8 | 375.0 to 407.0 |
| recap Voice Mirror card | then sing back five notes it plays. | outfit 600 34 | 500.0 | 326.0 to 824.0 | 435.0 to 468.0 |
| recap Voice Mirror card | Free, no account: mercurypitch.com/mirror | outfit 600 40 | 777.8 | 272.0 to 1048.5 | 735.0 to 774.0 |
| recap Voice Mirror card | Sore, hoarse or unwell today? Just listen along. | outfit 500 34 | 701.5 | 270.0 to 969.7 | 685.0 to 718.0 |
| recap rest card (x 1160 to 1660) | Felt uncomfortable, or listened | outfit 600 28 | 388.7 | 1162.0 to 1547.2 | 275.0 to 301.0 |
| recap rest card (x 1160 to 1660) | along today? | outfit 600 28 | 164.9 | 1160.0 to 1323.9 | 311.0 to 338.0 |
| recap rest card (x 1160 to 1660) | Voice Mirror will be here when | outfit 600 30 | 403.4 | 1160.0 to 1562.5 | 448.0 to 471.0 |
| recap rest card (x 1160 to 1660) | your voice feels comfortable: | outfit 600 30 | 391.7 | 1160.0 to 1550.3 | 486.0 to 515.0 |
| recap rest card (x 1160 to 1660) | mercurypitch.com/mirror | outfit 600 36 | 414.5 | 1162.0 to 1574.9 | 539.0 to 574.0 |
| end card | mercurypitch.com/mirror | outfit 600 72 | 829.0 | 124.0 to 948.8 | 266.0 to 335.0 |
| end card | Voice Mirror is free, with no account | outfit 500 44 | 695.6 | 121.0 to 815.0 | 362.0 to 402.0 |
