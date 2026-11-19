# Kit probe: every module at its HANDOFFS pixels

Written by `lab/kit-src/probe.mjs` (Chromium with the film's fonts). Each row is a lab page seeked to a time, a value read from the DOM (screen px, after every layer's transform), and the HANDOFFS value it must match within the tolerance (2 px unless given).

**370 of 370 pass.**

| Page | t | Check | Measured | HANDOFFS | Tol | Pass |
| - | - | - | - | - | - | - |
| chart | 2 | the line's tail clear of the axis "0" (right-aligned 388, baseline 523) | 12 | >= 12 | 2 | yes |
| chart | 4.5 | S1 band x 400 to 1520 (left) | 400 | 400 | 2 | yes |
| chart | 4.5 | S1 band right | 1520 | 1520 | 2 | yes |
| chart | 4.5 | S1 band top (35 cents at 2.5 px) | 312.5 | 312.5 | 2 | yes |
| chart | 4.5 | S1 band foot | 487.5 | 487.5 | 2 | yes |
| chart | 4.5 | wave rule W 4: peak to peak 280 / W | 70 | 70 | 1 | yes |
| chart | 4.5 | wave rule W 4: a cycle 203.6 / W | 50.92 | 50.9 | 1 | yes |
| chart | 4.5 | wave rule ratio (cycle / height) 0.727 | 0.73 | 0.73 | 0.02 | yes |
| chart | 4.5 | strip hairline y 690 | 690 | 690 | 1 | yes |
| chart | 4.5 | "A3" right edge 366 (anchor end) | 366 | 366 | 2 | yes |
| chart | 4.5 | ILLUSTRATION x 1249 to 1520 (right) | 1520.01 | 1520 | 2 | yes |
| chart | 4.5 | ILLUSTRATION left | 1249.31 | 1249 | 3 | yes |
| chart | 4.5 | ILLUSTRATION y 120 to 160 | 120 | 120 | 2 | yes |
| chart | 4.5 | LISTEN ONLY left 1536 | 1536 | 1536 | 2 | yes |
| chart | 4.5 | LISTEN ONLY right 1786 | 1786.41 | 1786 | 3 | yes |
| chart | 7.2 | at 0.78: band left 466 | 466 | 466 | 2 | yes |
| chart | 7.2 | at 0.78: band right 1340 | 1339.6 | 1340 | 2 | yes |
| chart | 7.2 | at 0.78: band top 365.5 (W 6: 1.667 px a cent) | 365.5 | 365.5 | 2.5 | yes |
| chart | 7.2 | at 0.78: band foot 456.5 | 456.51 | 456.5 | 2.5 | yes |
| chart | 7.2 | ILLUSTRATION at 0.78: x 1128 to 1340 (left) | 1128.46 | 1128 | 3 | yes |
| chart | 7.2 | LISTEN ONLY at 0.78: from 1352 | 1352.08 | 1352 | 2 | yes |
| chart | 7.2 | LISTEN ONLY at 0.78: y 192 to 224 (foot) | 223.8 | 224 | 2 | yes |
| chart | 7.2 | thumb at 0.78 (p 100 held): x 903 is p 50; here p 100 at 1340 | 1339.6 | 1339.6 | 2 | yes |
| chart | 11.9 | S10 band top (W 10: 1 px a cent) | 365 | 365 | 2 | yes |
| chart | 11.9 | S10 band foot | 435 | 435 | 2 | yes |
| chart | 11.9 | wave rule W 10: peak to peak 28 | 28 | 28 | 1 | yes |
| chart | 11.9 | wave rule W 10: a cycle 20.36 | 20.37 | 20.36 | 1 | yes |
| cuts | 2 | cut 2: the carried object holds its pixels (left) | 738 | 738 | 2 | yes |
| cuts | 2 | cut 2: top | 279.25 | 279.25 | 2 | yes |
| cuts | 2 | cut 2: right | 1662 | 1662 | 2 | yes |
| cuts | 2 | cut 2: foot | 730.75 | 730.75 | 2 | yes |
| cuts | 2 | cut 2: the first frame shows the outgoing room (ghost 1, rest 0) | 1 / 0 | 1.000 / 0.000 | 2 | yes |
| cuts | 2.15 | cut 2.0 + 0.15 s: halfway through the crossfade | 0.5 | 0.5 | 0.05 | yes |
| cuts | 2.33 | cut + 0.33 s: the outgoing room gone (ghost S7) | 0 | 0 | 0.001 | yes |
| cuts | 6 | cut 6: the carried object holds its pixels (left) | 928 | 928 | 2 | yes |
| cuts | 6 | cut 6: top | 104 | 104 | 2 | yes |
| cuts | 6 | cut 6: right | 1824 | 1824 | 2 | yes |
| cuts | 6 | cut 6: foot | 202 | 202 | 2 | yes |
| cuts | 6 | cut 6: the first frame shows the outgoing room (ghost 1, rest 0) | 1 / 0 | 1.000 / 0.000 | 2 | yes |
| cuts | 6.33 | cut + 0.33 s: the outgoing room gone (ghost S13) | 0 | 0 | 0.001 | yes |
| figure | 0.1 | S6 head x | 464.5 | 464 | 2 | yes |
| figure | 0.1 | S6 head y | 217.75 | 218 | 2 | yes |
| figure | 0.1 | S6 throat x | 487.5 | 488 | 2 | yes |
| figure | 0.1 | S6 throat y | 338.5 | 339 | 2 | yes |
| figure | 0.1 | S6 lungs x | 476 | 476 | 2 | yes |
| figure | 0.1 | S6 lungs y | 505.25 | 505 | 2 | yes |
| figure | 0.1 | S6 domeApex x | 476 | 476 | 2 | yes |
| figure | 0.1 | S6 domeApex y | 620.25 | 620 | 2 | yes |
| figure | 0.1 | S6 domeL x | 378.25 | 378.25 | 2 | yes |
| figure | 0.1 | S6 domeL y | 660.5 | 660.5 | 2 | yes |
| figure | 0.1 | S6 domeR x | 573.75 | 573.75 | 2 | yes |
| figure | 0.1 | S6 domeR y | 660.5 | 660.5 | 2 | yes |
| figure | 0.1 | S6 hips y 764 | 764 | 764 | 2 | yes |
| figure | 0.1 | S6 at rest: the dome's back end on the back's inner side (u 151.5) | 151.5 | 151.5 | 0.01 | yes |
| figure | 0.1 | S6 at rest: the dome's front end on the belly wall's inner side (wall u 330.0) | 330 | 330 | 0.5 | yes |
| figure | 1.4 | S6 breathing in: belly front at u 360 (x 614) | 614 | 614 | 2 | yes |
| figure | 1.4 | S6 breathing in: lungs centre v 345 (y 516.75) | 516.75 | 516.75 | 2 | yes |
| figure | 1.4 | S6 breathing in: the dome's back end on the back's inner side (u 151.5) | 151.5 | 151.5 | 0.01 | yes |
| figure | 1.4 | S6 breathing in: the dome's front end on the belly wall's inner side (wall u 359.9) | 359.94 | 359.94 | 0.5 | yes |
| figure | 3.4 | S6 breathing out: belly front at u 315 (x 562.25) | 562.25 | 562.25 | 2 | yes |
| figure | 3.4 | S6 breathing out: the dome's back end on the back's inner side (u 151.5) | 151.5 | 151.5 | 0.01 | yes |
| figure | 3.4 | S6 breathing out: the dome's front end on the belly wall's inner side (wall u 317.2) | 317.16 | 317.16 | 0.5 | yes |
| figure | 7.3 | S8 head x | 991 | 991 | 2 | yes |
| figure | 7.3 | S8 head y | 199.5 | 199.5 | 2 | yes |
| figure | 7.3 | S8 chin x | 1029.5 | 1029.5 | 2 | yes |
| figure | 7.3 | S8 chin y | 238 | 238 | 2 | yes |
| figure | 7.3 | S8 throat x | 1005 | 1005 | 2 | yes |
| figure | 7.3 | S8 throat y | 273 | 273 | 2 | yes |
| figure | 7.3 | S8 shoulder x | 952.5 | 952.5 | 2 | yes |
| figure | 7.3 | S8 shoulder y | 304.5 | 304.5 | 2 | yes |
| figure | 7.3 | S8 lungs x | 998 | 998 | 2 | yes |
| figure | 7.3 | S8 lungs y | 374.5 | 374.5 | 2 | yes |
| figure | 7.3 | S8 domeApex x | 998 | 998 | 2 | yes |
| figure | 7.3 | S8 domeApex y | 444.5 | 444.5 | 2 | yes |
| figure | 7.3 | S8 knee x | 994.5 | 994.5 | 2 | yes |
| figure | 7.3 | S8 knee y | 686 | 686 | 2 | yes |
| figure | 7.3 | S8 soles on the floor line (840) | 840 | 840 | 2 | yes |
| figure | 7.3 | S8 belly front x 1061 | 1061 | 1061 | 2 | yes |
| figure | 7.3 | S8 standing height (crown to soles, px) | 686 | 686 | 1 | yes |
| figure | 8.2 | S8 mid-breath: the dome's back end on the back's inner side (u 151.5) | 151.5 | 151.5 | 0.01 | yes |
| figure | 8.2 | S8 mid-breath: the dome's front end on the belly wall's inner side (wall u 325.8) | 325.75 | 325.75 | 0.5 | yes |
| figure | 10.5 | S13 crown y 105 | 105 | 105 | 2 | yes |
| figure | 10.5 | S13 back x 1262.5 | 1262.5 | 1262.5 | 2 | yes |
| folds | 2 | folds box x 220 | 220 | 220 | 2 | yes |
| folds | 2 | folds box right 560 | 560 | 560 | 2 | yes |
| folds | 2 | folds box top 260 | 260 | 260 | 2 | yes |
| folds | 2 | folds box foot 600 | 600 | 600 | 2 | yes |
| folds | 2 | strip x 700 | 700 | 700 | 2 | yes |
| folds | 2 | strip right 1600 | 1600 | 1600 | 2 | yes |
| folds | 2 | strip y 320 to 540 (centre 430, h 110) | 320 | 320 | 2 | yes |
| folds | 2 | x(t) = 700 + 562.5 t at 1.6 s | 1600 | 1600 | 0.01 | yes |
| folds | 5.5 | stack row 1 centre y 250 (h 70) | 250 | 250 | 2 | yes |
| folds | 5.5 | stack row 2 centre y 450 (h 70) | 450 | 450 | 2 | yes |
| folds | 5.5 | stack row 3 centre y 650 (h 70) | 650 | 650 | 2 | yes |
| folds | 7.9 | voice box x 300 to 640 (left) | 300 | 300 | 2 | yes |
| folds | 7.9 | voice box right | 640 | 640 | 2 | yes |
| folds | 7.9 | voice box y 190 to 510 (top) | 190 | 190 | 2 | yes |
| folds | 7.9 | voice box foot | 510 | 510 | 2 | yes |
| gauge | 0 | split start: band x 466 (the chart at 0.78) | 466 | 466 | 2 | yes |
| gauge | 0 | band right 1340 | 1340 | 1340 | 2 | yes |
| gauge | 0 | band top 365.5 | 365.5 | 365.5 | 2 | yes |
| gauge | 0 | band foot 456.5 | 456.5 | 456.5 | 2 | yes |
| gauge | 3.3 | "push of air (not pitch)" has an opaque ground back over the cursor | #0d1117, covers true, above true | opaque, covering, above | 2 | yes |
| gauge | 3.3 | "the lungs' own push" has an opaque ground back over the cursor | #0d1117, covers true, above true | opaque, covering, above | 2 | yes |
| gauge | 3.3 | "what the note needs" has an opaque ground back over the cursor | #0d1117, covers true, above true | opaque, covering, above | 2 | yes |
| gauge | 3.3 | "held back" has an opaque ground back over the cursor | #0d1117, covers true, above true | opaque, covering, above | 2 | yes |
| gauge | 3.3 | "added" has an opaque ground back over the cursor | #0d1117, covers true, above true | opaque, covering, above | 2 | yes |
| gauge | 3.3 | "Now: holding back" has an opaque ground back over the cursor | #0d1117, covers true, above true | opaque, covering, above | 2 | yes |
| gauge | 3.3 | "Now: adding" has an opaque ground back over the cursor | #0d1117, covers true, above true | opaque, covering, above | 2 | yes |
| gauge | 3.3 | the chip is opaque and over the cursor | 1 | 1 | 2 | yes |
| gauge | 5.9 | before the crossing: the readout says "Now: holding back" | 1 | 1 | 0.01 | yes |
| gauge | 5.9 | "added" not yet landed | 0 | 0 | 0.01 | yes |
| gauge | 6.3 | after the crossing: "Now: adding" | 1 | 1 | 0.01 | yes |
| gauge | 6.3 | "Now: holding back" gone | 0 | 0 | 0.01 | yes |
| gauge | 6.3 | "added" landed at the crossing | 1 | 1 | 0.01 | yes |
| gauge | 6.3 | "added" glyphs under the gold line (607.5) by 12 px or more | 15.5 | >= 12 | 2 | yes |
| gauge | 6.3 | "added" over the lungs' line at its left end by 12 px or more | 20.71 | >= 12 | 2 | yes |
| gauge | 6.3 | "added" right of the crossing (x 1376) | 1516.6 | > 1376 | 2 | yes |
| gauge | 8.9 | small band x 760 to 1640 (left) | 760 | 760 | 2 | yes |
| gauge | 8.9 | small band right | 1640 | 1640 | 2 | yes |
| gauge | 8.9 | small band y 160 to 240 (top) | 160 | 160 | 2 | yes |
| gauge | 8.9 | small band foot | 240 | 240 | 2 | yes |
| gauge | 8.9 | frame x 760 | 760 | 760 | 2 | yes |
| gauge | 8.9 | frame right 1640 | 1640 | 1640 | 2 | yes |
| gauge | 8.9 | frame top 290 | 290 | 290 | 2 | yes |
| gauge | 8.9 | frame foot 720 | 720 | 720 | 2 | yes |
| gauge | 8.9 | gold line at Loud: y 454 (centre) | 454 | 454 | 1.5 | yes |
| gauge | 8.9 | tag right 1630 (9 px in from the stroke) | 1630.01 | 1630 | 2 | yes |
| gauge | 8.9 | tag top 300 | 300 | 300 | 2 | yes |
| gauge | 8.9 | Quiet chip from x 1653 (12 screen px off the stroke's outer edge at F-gauge) | 1653 | 1653 | 2 | yes |
| gauge | 8.9 | Quiet chip y 301 to 339 (top) | 301 | 301 | 2 | yes |
| gauge | 8.9 | Loud chip foot 391 | 391 | 391 | 2 | yes |
| gauge | 8.9 | the lungs cross Quiet at 7 s (x(7) = 1376) | 1376 | 1376 | 0.5 | yes |
| gauge | 8.9 | the lungs cross Loud at 3 s (x(3) = 1024) | 1024 | 1024 | 0.5 | yes |
| hook | 3.4 | long note starts at (560, 520): x | 560 | 560 | 2 | yes |
| hook | 3.4 | y | 520 | 520 | 2 | yes |
| hook | 3.4 | ends at x 1360 | 1360 | 1360 | 2 | yes |
| hook | 3.4 | head bead centre x 560 | 560.01 | 560 | 2 | yes |
| hook | 3.4 | head bead centre y 520 | 520.01 | 520 | 2 | yes |
| hook | 3.4 | head bead r 22 on screen | 22 | 22 | 0.5 | yes |
| hook | 3.4 | "support" baseline 420 at the last frame | 420 | 420 | 0.5 | yes |
| hook | 3.4 | "support" anchored middle at x 960, as Lesson 4's S15 (its italic ink centre 965.7) | 960 | 960 | 0.5 | yes |
| hook | 3.4 | "what keeps it steady?" baseline 680 | 680 | 680 | 0.5 | yes |
| hook | 3.4 | the long note's stroke on screen at F-hook: 4 px (Lesson 4's weight) | 4 | 4 | 0.05 | yes |
| hook | 3.4 | Lesson 4's s15 geometry: the note x 560 to 1360 at y 520, "support" 160 px at (960, 420), "what keeps it steady?" 96 px at (960, 680) | 560-1360 @ 520; 160px | as s15 | 2 | yes |
| hosts | 1 | Tavi box left 1650 (x 1800, size 300) | 1650 | 1650 | 2 | yes |
| hosts | 1 | box top 589.2 (feet at 0.836) | 589.19 | 589.2 | 2 | yes |
| hosts | 1 | feet line 840 | 839.99 | 840 | 2 | yes |
| hosts | 1 | reflection's sole row on 840 (flipped about it) | 839.98 | 840 | 2 | yes |
| hosts | 1 | Tavi mirrored by default (scaleX(-1)) | scaleX(-1) | scaleX(-1) | 2 | yes |
| hosts | 1 | Merc not mirrored by default | none | none | 2 | yes |
| hosts | 3.3 | after the size change: feet still on 840 | 839.99 | 840 | 2 | yes |
| hosts | 3.3 | drawn at 240 | 240 | 240 | 2 | yes |
| hosts | 3.3 | the reflection's sole row still on 840 | 839.98 | 840 | 2 | yes |
| hosts | 3.9 | leap: carried in from 300 px beyond (x at u) | -85.35 | -85.35 | 2 | yes |
| hosts | 3.9 | leap: lifted | 63.61 | 63.6 | 2 | yes |
| hosts | 3.9 | its reflection stays mirrored about the floor | 63.58 | 63.6 | 2 | yes |
| mixup | 1.5 | 7a end: the small band on the chart's band, x 400 | 400 | 400 | 2 | yes |
| mixup | 1.5 | right 1520 | 1520.01 | 1520 | 2 | yes |
| mixup | 1.5 | top 382.5 (470 - 87.5) | 382.5 | 382.5 | 2 | yes |
| mixup | 1.5 | foot 557.5 | 557.5 | 557.5 | 2 | yes |
| mixup | 3.5 | row 0: dashed underline at y 194 under the whole row (left 360) | 360 | 358.5 | 2 | yes |
| mixup | 3.5 | row 0: underline right = the words' end | 1215.06 | 1216.56 | 2 | yes |
| mixup | 3.5 | row 0: its "?" 14 px after the last word | 14 | 14 | 6 | yes |
| mixup | 3.5 | row 1: its "ILLUSTRATION" chip from x 360 | 360 | 360 | 2 | yes |
| mixup | 3.5 | row 1: chip centred y 345 | 345 | 345 | 2 | yes |
| mixup | 3.5 | row 1: the chart at 0.41, band from x 1180 | 1180 | 1180 | 2 | yes |
| mixup | 3.5 | right 1639.2 | 1639.2 | 1639.2 | 2 | yes |
| mixup | 3.5 | top 274.1 | 274.13 | 274.1 | 2 | yes |
| mixup | 3.5 | foot 345.9 | 345.88 | 345.9 | 2 | yes |
| mixup | 4.9 | pair: "easy" x 860 to 1200 | 860 | 860 | 2 | yes |
| mixup | 4.9 | "easy" y 570 to 790 (top) | 570 | 570 | 2 | yes |
| mixup | 4.9 | "easy" foot | 790 | 790 | 2 | yes |
| mixup | 4.9 | "pressed" x 1260 to 1600 (right) | 1600 | 1600 | 2 | yes |
| mixup | 4.9 | "pressed" y 652 to 708 (top) | 652 | 652 | 2 | yes |
| mixup | 6.9 | row 2 (0.5): "easy" from x 1180 | 1180 | 1180 | 2 | yes |
| mixup | 6.9 | "easy" top 465 | 465 | 465 | 2 | yes |
| mixup | 6.9 | "pressed" right 1550 | 1550 | 1550 | 2 | yes |
| mixup | 6.9 | row 2 names baseline 605 (26 px) | 605 | 605 | 0.5 | yes |
| recap | 0 | at the cut only Merc's line shows (no voice line drawn) | 0 | 0 | 2 | yes |
| recap | 0 | Merc's line keeps F-turn's 5.6 px at the cut | 5.6 | 5.6 | 0.01 | yes |
| recap | 0 | slide start: frame x 928 (F-turn's pixels) | 928 | 928 | 2 | yes |
| recap | 0 | right 1824 | 1824 | 1824 | 2 | yes |
| recap | 0 | band 104 | 104 | 104 | 2 | yes |
| recap | 0 | band foot 202 | 202 | 202 | 2 | yes |
| recap | 2.9 | the voice's wave keeps the rule here (k / rule k) | 1 | 1 | 0.05 | yes |
| recap | 2.9 | recap frame x 232 | 232 | 232 | 2 | yes |
| recap | 2.9 | right 1688 | 1688 | 1688 | 2 | yes |
| recap | 2.9 | band 554.5 | 554.5 | 554.5 | 2 | yes |
| recap | 2.9 | band foot 645.5 | 645.5 | 645.5 | 2 | yes |
| recap | 2.9 | "ILLUSTRATION" right 1688 | 1688.01 | 1688 | 2 | yes |
| recap | 2.9 | "ILLUSTRATION" centred y 500 | 500 | 500 | 2 | yes |
| recap | 4.9 | panel x 120 to 960 (left) | 120 | 120 | 2 | yes |
| recap | 4.9 | panel right | 960 | 960 | 2 | yes |
| recap | 4.9 | panel top 140 | 140 | 140 | 2 | yes |
| recap | 4.9 | panel foot 330 | 330 | 330 | 2 | yes |
| recap | 9.4 | Voice Mirror card x 230 to 1110 (left) | 230 | 230 | 2 | yes |
| recap | 9.4 | right | 1110 | 1110 | 2 | yes |
| recap | 9.4 | top 90 | 90 | 90 | 2 | yes |
| recap | 9.4 | foot at full 790 | 790 | 790 | 2 | yes |
| recap | 9.4 | rest card x 1130 to 1690 (left) | 1130 | 1130 | 2 | yes |
| recap | 9.4 | rest card y 250 to 600 (foot) | 600 | 600 | 2 | yes |
| recap | 9.4 | "five notes" glyph's first dot (272, 448) before the drift | 272 | 272 | 2 | yes |
| recap | 9.4 | its y; after the 14 px drift 434 (the tease carry's start) | 434 | 434 | 2 | yes |
| room | 0.2 | F-cold: world (400,400) x | 456 | 456 | 2 | yes |
| room | 0.2 | F-cold: world (400,400) y | 405 | 405 | 2 | yes |
| room | 0.2 | F-cold: world (1520,400) x | 1464 | 1464 | 2 | yes |
| room | 0.2 | F-cold: world (1520,400) y | 405 | 405 | 2 | yes |
| room | 0.2 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 3.6 | F-cold end: world (400,400) x | 444.8 | 444.8 | 2 | yes |
| room | 3.6 | F-cold end: world (400,400) y | 404 | 404 | 2 | yes |
| room | 3.6 | F-cold end: world (1520,400) x | 1475.2 | 1475.2 | 2 | yes |
| room | 3.6 | F-cold end: world (1520,400) y | 404 | 404 | 2 | yes |
| room | 3.6 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 7 | F-hook: world (400,400) x | 560.01 | 560 | 2 | yes |
| room | 7 | F-hook: world (400,400) y | 520.01 | 520 | 2 | yes |
| room | 7 | F-hook: world (1520,400) x | 1360.01 | 1360 | 2 | yes |
| room | 7 | F-hook: world (1520,400) y | 520.01 | 520 | 2 | yes |
| room | 7 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 7.75 | F-bead: world (400,400) x | 960 | 960 | 2 | yes |
| room | 7.75 | F-bead: world (400,400) y | 540 | 540 | 2 | yes |
| room | 7.75 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 8.35 | F-promise-a: world (400,400) x | 480 | 480 | 2 | yes |
| room | 8.35 | F-promise-a: world (400,400) y | 400 | 400 | 2 | yes |
| room | 8.35 | F-promise-a: world (1520,400) x | 1600 | 1600 | 2 | yes |
| room | 8.35 | F-promise-a: world (1520,400) y | 400 | 400 | 2 | yes |
| room | 8.35 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 12.75 | F-promise-b: world (400,400) x | 320 | 320 | 2 | yes |
| room | 12.75 | F-promise-b: world (400,400) y | 400 | 400 | 2 | yes |
| room | 12.75 | F-promise-b: world (1520,400) x | 1440 | 1440 | 2 | yes |
| room | 12.75 | F-promise-b: world (1520,400) y | 400 | 400 | 2 | yes |
| room | 12.75 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 14.55 | F-strip: world (400,630) x | 176 | 176 | 2 | yes |
| room | 14.55 | F-strip: world (400,630) y | 182 | 182 | 2 | yes |
| room | 14.55 | F-strip: world (1520,750) x | 1744 | 1744 | 2 | yes |
| room | 14.55 | F-strip: world (1520,750) y | 350 | 350 | 2 | yes |
| room | 14.55 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 16.45 | F0: world (400,400) x | 400 | 400 | 2 | yes |
| room | 16.45 | F0: world (400,400) y | 400 | 400 | 2 | yes |
| room | 16.45 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 26.85 | F-gauge: world (760,290) x | 738 | 738 | 2 | yes |
| room | 26.85 | F-gauge: world (760,290) y | 279.25 | 279.25 | 2 | yes |
| room | 26.85 | F-gauge: world (1640,720) x | 1662 | 1662 | 2 | yes |
| room | 26.85 | F-gauge: world (1640,720) y | 730.75 | 730.75 | 2 | yes |
| room | 26.85 | near layer scale at F-gauge | 1.08 | 1.08 | 0.005 | yes |
| room | 26.85 | the push to F-gauge: least movement in any 0.5 s window (screen px, the corners' content) | 2.4 | >= 1 | 2 | yes |
| room | 26.85 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 29.15 | F-hold: world (960,400) x | 960 | 960 | 2 | yes |
| room | 29.15 | F-hold: world (960,400) y | 530 | 530 | 2 | yes |
| room | 29.15 | F-hold: world (400,400) x | 232 | 232 | 2 | yes |
| room | 29.15 | F-hold: world (400,400) y | 530 | 530 | 2 | yes |
| room | 29.15 | F-hold: world (1520,400) x | 1688 | 1688 | 2 | yes |
| room | 29.15 | F-hold: world (1520,400) y | 530 | 530 | 2 | yes |
| room | 29.15 | near layer scale at F-hold | 1.48 | 1.48 | 0.005 | yes |
| room | 29.15 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 31.05 | CU-scoop: world (400,400) x | 360 | 360 | 2 | yes |
| room | 31.05 | CU-scoop: world (400,400) y | 520 | 520 | 2 | yes |
| room | 31.05 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 33.45 | CU-wave: world (1000,400) x | 960 | 960 | 2 | yes |
| room | 33.45 | CU-wave: world (1000,400) y | 520 | 520 | 2 | yes |
| room | 33.45 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 35.31 | F-hold (back): world (960,400) x | 960 | 960 | 2 | yes |
| room | 35.31 | F-hold (back): world (960,400) y | 530 | 530 | 2 | yes |
| room | 35.31 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 37.21 | F-turn: world (1320,590) x | 1376 | 1376 | 2 | yes |
| room | 37.21 | F-turn: world (1320,590) y | 636 | 636 | 2 | yes |
| room | 37.21 | F-turn: world (1000,210) x | 928 | 928 | 2 | yes |
| room | 37.21 | F-turn: world (1000,210) y | 104 | 104 | 2 | yes |
| room | 37.21 | near layer scale at F-turn | 1.64 | 1.64 | 0.005 | yes |
| room | 37.21 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 41.2 | F-end: world (960,540) x | 960 | 960 | 2 | yes |
| room | 41.2 | F-end: world (960,540) y | 540 | 540 | 2 | yes |
| room | 41.2 | F-end: world (400,400) x | 383.2 | 383.2 | 2 | yes |
| room | 41.2 | F-end: world (400,400) y | 395.8 | 395.8 | 2 | yes |
| room | 41.2 | the chart's chip, whenever shown (every frame of the clip): its least distance to an edge | 16.02 | >= 16 | 2 | yes |
| room | 41.2 | the frame after each lab cut lifts no bokeh (one change, LAB-CHECKS 2) | none lifted | none lifted | 2 | yes |
| room | 41.2 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 21.65 | mid-push to F-gauge: layers part (far < mid < near) | 1.0063 / 1.0250 / 1.0400 | far < mid < near | 2 | yes |
| room | 21.65 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 27.1 | after the matched cut: near scale back to 1 | 1 | 1 | 0.0005 | yes |
| room | 27.1 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 35.56 | after the matched cut: near scale back to 1 | 1 | 1 | 0.0005 | yes |
| room | 35.56 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| room | 37.46 | after the matched cut: near scale back to 1 | 1 | 1 | 0.0005 | yes |
| room | 37.46 | floor line stays at y 840 (screen space) | 840 | 840 | 0.5 | yes |
| tease | 0 | carry starts at the dot (272, 434): x | 272 | 272 | 2 | yes |
| tease | 0 | y | 434 | 434 | 2 | yes |
| tease | 0 | r 4 | 4 | 4 | 0.01 | yes |
| tease | 1.6 | carry lands on C4 (420, 745): x | 420 | 420 | 2 | yes |
| tease | 1.6 | y | 745 | 745 | 2 | yes |
| tease | 1.6 | r 20 | 20 | 20 | 0.01 | yes |
| tease | 1.6 | its whole path left of x 450 | 420 | < 450 | 2 | yes |
| tease | 6.9 | C4 bead (420, 745) | 745 | 745 | 2 | yes |
| tease | 6.9 | G4 bead x 740 | 740 | 740 | 2 | yes |
| tease | 6.9 | G4 bead y 535 | 535 | 535 | 2 | yes |
| tease | 6.9 | A4 bead (1060, 475) y | 475 | 475 | 2 | yes |
| tease | 6.9 | last bead x 1380 | 1380 | 1380 | 2 | yes |
| tease | 6.9 | C4's copy six rows up (y 565) | 565 | 565 | 2 | yes |
| tease | 9.9 | end card: C4 bead at (1219, 370.5): x | 1219 | 1219 | 2 | yes |
| tease | 9.9 | y | 370.5 | 370.5 | 2 | yes |
| tease | 9.9 | the shrunk figure clear of the zone (left edge > 1100) | 1183 | > 1100 | 2 | yes |
| tease | 9.9 | address x 120, baseline 320 | 320 | 320 | 0.5 | yes |
| tease | 9.9 | free line baseline 395 | 395 | 395 | 0.5 | yes |
| tease | 9.9 | lockup width at h 100 (1180 x 100 / 260) | 453.85 | 453.85 | 0.5 | yes |
| tease | 9.9 | lockup ink from x 124.6 (the orb's own 12-unit margin) | 124.62 | 124.6 | 2 | yes |
| title | 0.3 | the field’s grain changes every frame (seeds) | 634 638 642 | all different | 2 | yes |
| title | 0.3 | the field breathes: no 0.2 s window of S1's last 0.6 s with one centre colour | 0 still windows | 0 still windows | 2 | yes |
| title | 1.2 | the field has closed into the bead (r 22 x zoom): bead width / 2 | 22.61 | 22.61 | 1.5 | yes |
| title | 1.2 | the bead on its rest, z-mapped (x) | 1062.78 | 1062.78 | 2 | yes |
| turn | 5.9 | ring centre (1320, 590): x | 1320 | 1320 | 2 | yes |
| turn | 5.9 | ring centre y | 590 | 590 | 2 | yes |
| turn | 5.9 | ring r 160 (x 1.04 breathing at 9.8 s) | 160.01 | 160 | 2 | yes |
| turn | 5.9 | frame band x 1000 to 1640 (left) | 1000 | 1000 | 2 | yes |
| turn | 5.9 | frame band right | 1640 | 1640 | 2 | yes |
| turn | 5.9 | frame band y 210 to 280 (top) | 210 | 210 | 2 | yes |
| turn | 5.9 | frame band foot | 280 | 280 | 2 | yes |
| turn | 5.9 | playhead at 9.8 s: x 1000 + 64 t | 1627.2 | 1627.2 | 2 | yes |
| turn | 5.9 | "Your turn." x 260 | 260 | 260 | 0.5 | yes |
| turn | 5.9 | "Your turn." baseline 200 | 200 | 200 | 0.5 | yes |
| turn | 5.9 | care icon box top-left (260, 236): x (its 36 px box; the leaf's ink starts at 267.5) | 260 | 260 | 0.5 | yes |
| turn | 5.9 | care icon box y (ink from 240.5) | 236 | 236 | 0.5 | yes |
| turn | 5.9 | doctor lines broken at 700 px (count) | 4 | 4 | 2 | yes |
| turn | 7.6 | F-turn: ring centre (1376, 636): x | 1376 | 1376 | 2 | yes |
| turn | 7.6 | F-turn: ring centre y | 636 | 636 | 2 | yes |
| turn | 7.6 | F-turn: ring r 224 | 224 | 224 | 2 | yes |
| turn | 7.6 | F-turn: frame x 928 | 928 | 928 | 2 | yes |
| turn | 7.6 | F-turn: frame right 1824 | 1824 | 1824 | 2 | yes |
| turn | 7.6 | F-turn: band 104 | 104 | 104 | 2 | yes |
| turn | 7.6 | F-turn: band foot 202 | 202 | 202 | 2 | yes |
| turn | 7.6 | care block holds still through the push ("Your turn." box left) | 260 | 260 | 1 | yes |
| turn | 7.6 | the phase row and its lines are gone before the push lands | 0 | 0 | 0.001 | yes |
| turn | 7.6 | nothing of the turn visible under y 880 (the caption band) at F-turn | 867 | <= 880 | 2 | yes |
| type | 1.2 | chapter card centred on x 960 | 960.53 | 960 | 3 | yes |
| type | 1.2 | chapter card at most 1680 px wide (t 1.2, breathing) | 1659.31 | <= 1680 | 2 | yes |
| type | 1.95 | chapter card centred on x 960 | 960.72 | 960 | 3 | yes |
| type | 1.95 | chapter card at most 1680 px wide (t 1.95, its breathing at its peak) | 1678.02 | <= 1680 | 2 | yes |
| type | 3.9 | pill 1: text pad left (24) | 24.3 | 24 | 1.5 | yes |
| type | 3.9 | pill 1: text pad right (24) | 24.29 | 24 | 1.5 | yes |
| type | 3.9 | pill 1 left | 462 | 462 | 2 | yes |
| type | 3.9 | pill 1 right | 930 | 930 | 2 | yes |
| type | 3.9 | pill 1 top 82 | 82 | 82 | 2 | yes |
| type | 3.9 | pill 1 foot 134 | 134 | 134 | 2 | yes |
| type | 3.9 | pill 2: text pad left (24) | 24.63 | 24 | 1.5 | yes |
| type | 3.9 | pill 2: text pad right (24) | 24.41 | 24 | 1.5 | yes |
| type | 3.9 | pill 2 left | 970 | 970 | 2 | yes |
| type | 3.9 | pill 2 right | 1430 | 1430 | 2 | yes |
| type | 3.9 | pill 2 top 82 | 82 | 82 | 2 | yes |
| type | 3.9 | pill 2 foot 134 | 134 | 134 | 2 | yes |
| type | 3.9 | the ticked pill is the board's second, "Get louder and drift higher" (its check drawn, the first's not) | check opacity 0.000 / 1.000 | second only | 2 | yes |
| type | 3.9 | the check in the gap: clear of the first pill (930) by | 9 | >= 8.5 | 2 | yes |
| type | 3.9 | ring timer centre x 1480 | 1480 | 1480 | 2 | yes |
| type | 3.9 | ring timer centre y 108 | 108 | 108 | 2 | yes |
| type | 5 | tag "ILLUSTRATION" width (board 271) | 270.69 | 271 | 4 | yes |
| type | 5 | tag "ILLUSTRATION" height 40 | 40 | 40 | 2 | yes |
| type | 5 | tag "LISTEN ONLY" width (board 250) | 250.41 | 250 | 4 | yes |
| type | 5 | tag "LISTEN ONLY" height 40 | 40 | 40 | 2 | yes |
| type | 5 | tag "SLOWED · ILLUSTRATION" width (board 453) | 453.21 | 453 | 4 | yes |
| type | 5 | tag "SLOWED · ILLUSTRATION" height 40 | 40 | 40 | 2 | yes |
| type | 5 | ILLUSTRATION right edge 1520 | 1520.01 | 1520 | 2 | yes |
| type | 5 | LISTEN ONLY left edge 1536 | 1536 | 1536 | 2 | yes |
| type | 5 | SLOWED chip x 1110 to 1563 | 1563.21 | 1563 | 4 | yes |
| type | 5 | four words: gap 1 is 12 px | 11.99 | 12 | 0.5 | yes |
| type | 5 | four words: gap 2 is 12 px | 12 | 12 | 0.5 | yes |
| type | 5 | four words: gap 3 is 12 px | 12 | 12 | 0.5 | yes |
| type | 5 | four words: right edge 1800 | 1800 | 1800 | 2 | yes |
| type | 5 | four words: outline top 68 | 68 | 68 | 2 | yes |
| type | 5 | four words: outline foot 106 | 106 | 106 | 2 | yes |
| type | 5 | four words: row left edge (chosen 12 px gaps) | 1132.55 | 1132.55 | 2 | yes |
| type | 5 | kicker x 120 | 120 | 120 | 2 | yes |
| type | 5 | kicker baseline 110 | 110 | 110 | 2 | yes |
