# Words check: the final takes against the script

Written by `tools/import.py`. Each take was transcribed by the aligner's own model (wav2vec2-base-960h, greedy CTC: the likeliest letter of every 20 ms, with no dictionary and no language model) and set beside its script line as that model spells it (capitals, the apostrophe, a numeral as its word). No other service heard the takes.

**A difference is a prompt for a person to listen, not a verdict.** The model spells by ear ("DIAPHRAM", "TAVY"), so most differences are its spelling. Two things sort them: a stretch counts as spelling when its letters, spaces aside, are 0.6 or more alike (the model also joins and splits words); and "scratch too" marks a stretch the model heard the very same way in the Kokoro take of the line, which speaks the script by construction. "Weakest word" is the script word the forced alignment found least support for (mean log-probability of its letters; nearer 0 is surer).

- Lines checked: 71.
- Words differ, to listen to first: 22 (o2, o3, b6, o4, o5, o6, b11, o7, o8, b18, b21, b27a, o11, b29, o12, b32, b42, b47, b48, b55, b58, o15).
- Differ in spelling only: 27.
- Heard exactly as written: 22 (b3, b8, b9, b12, b13, b16, b20, o9, b22, b27, b28, o13, b33, b37a, b40, b41, b43, b49, b52, b54, b59, b60).

## By the alignment's support, least first

The mean log-probability of the script's own letters on the take (nearer 0 is surer). It is a second view, blind to spelling: a line far under its host's others is worth an ear whatever the transcript says. Tavi's voice scores lower than Merc's throughout.

| Line | Host | Support | Weakest word | Words check |
| --- | --- | --- | --- | --- |
| o4 | Tavi | -1.68 | "If" (-5.37) | words differ |
| o12 | Tavi | -0.70 | "steady?" (-2.27) | words differ |
| o5 | Tavi | -0.60 | "said" (-2.66) | words differ |
| o11 | Tavi | -0.45 | "does" (-1.88) | words differ |
| o7 | Tavi | -0.43 | "back." (-3.91) | words differ |
| o14a | Tavi | -0.31 | "pitch" (-1.87) | spelling only |
| o1 | Tavi | -0.29 | "harder," (-1.79) | spelling only |
| o3 | Tavi | -0.22 | "Lesson" (-1.34) | words differ |
| o6 | Tavi | -0.22 | "diaphragm?" (-1.95) | words differ |
| o8 | Tavi | -0.21 | "What" (-1.16) | words differ |
| o15 | Tavi | -0.19 | "tune?" (-2.53) | words differ |
| o10 | Tavi | -0.17 | "start?" (-0.83) | spelling only |
| o2 | Tavi | -0.15 | ""support"" (-1.21) | words differ |
| o9 | Tavi | -0.05 | "in?" (-0.18) | as written |
| o13 | Tavi | -0.03 | "Then" (-0.08) | as written |
| b42 | Merc | -1.23 | "in." (-2.38) | words differ |
| b47 | Merc | -0.82 | "check." (-1.63) | words differ |
| b48 | Merc | -0.68 | "job?" (-2.76) | words differ |
| b29 | Merc | -0.42 | "Tavi," (-2.66) | words differ |
| b38 | Merc | -0.38 | "up." (-2.16) | spelling only |
| b30 | Merc | -0.29 | "Sung" (-4.07) | spelling only |
| b18 | Merc | -0.27 | "a" (-4.63) | words differ |
| b35 | Merc | -0.17 | "care" (-1.10) | spelling only |
| b44 | Merc | -0.17 | "breaths." (-1.30) | spelling only |
| b26 | Merc | -0.16 | "folds" (-1.35) | spelling only |
| b11 | Merc | -0.15 | "in." (-0.69) | words differ |
| b58 | Merc | -0.14 | "Mirror" (-2.26) | words differ |
| b19 | Merc | -0.11 | "breath" (-0.92) | spelling only |
| b21 | Merc | -0.11 | "unlocked." (-0.59) | words differ |
| b32 | Merc | -0.11 | "length," (-1.32) | words differ |
| b6 | Merc | -0.09 | "At" (-0.62) | words differ |
| b25 | Merc | -0.09 | ""h"," (-0.64) | spelling only |
| b27a | Merc | -0.09 | "puff," (-0.84) | words differ |
| b31 | Merc | -0.09 | "can" (-0.84) | spelling only |
| b3 | Merc | -0.08 | "a" (-0.50) | as written |
| b36 | Merc | -0.08 | "hoarse" (-0.37) | spelling only |
| b55 | Merc | -0.08 | "it" (-0.92) | words differ |
| b4 | Merc | -0.07 | "diaphragm" (-0.76) | spelling only |
| b34 | Merc | -0.07 | "turn:" (-0.23) | spelling only |
| b15 | Merc | -0.06 | "diaphragm" (-0.44) | spelling only |
| b46a | Merc | -0.06 | "hoarseness" (-0.66) | spelling only |
| b7 | Merc | -0.05 | "folds" (-0.31) | spelling only |
| b16 | Merc | -0.05 | "but" (-0.22) | as written |
| b24 | Merc | -0.05 | "onset." (-0.24) | spelling only |
| b39 | Merc | -0.05 | "low" (-0.30) | spelling only |
| b49 | Merc | -0.05 | "Breathing" (-0.07) | as written |
| b51 | Merc | -0.05 | "start" (-0.38) | spelling only |
| b13 | Merc | -0.04 | "your" (-0.13) | as written |
| b14 | Merc | -0.04 | "some" (-0.17) | spelling only |
| b17 | Merc | -0.04 | "Pushing" (-0.15) | spelling only |
| b22 | Merc | -0.04 | "low," (-0.12) | as written |
| b37 | Merc | -0.04 | "you're" (-0.18) | spelling only |
| b40 | Merc | -0.04 | "the" (-0.21) | as written |
| b56 | Merc | -0.04 | "com" (-0.24) | spelling only |
| b60 | Merc | -0.04 | "move" (-0.14) | as written |
| b1 | Merc | -0.03 | "drift" (-0.11) | spelling only |
| b9 | Merc | -0.03 | "in" (-0.15) | as written |
| b28 | Merc | -0.03 | "then" (-0.14) | as written |
| b33 | Merc | -0.03 | "air" (-0.19) | as written |
| b41 | Merc | -0.03 | "uncomfortable." (-0.06) | as written |
| b45 | Merc | -0.03 | "before" (-0.11) | spelling only |
| b46 | Merc | -0.03 | "for" (-0.11) | spelling only |
| b8 | Merc | -0.02 | "holds," (-0.08) | as written |
| b12 | Merc | -0.02 | "start" (-0.10) | as written |
| b20 | Merc | -0.02 | "flow" (-0.07) | as written |
| b27 | Merc | -0.02 | "starts" (-0.08) | as written |
| b52 | Merc | -0.02 | "sound" (-0.10) | as written |
| b54 | Merc | -0.02 | "there." (-0.07) | as written |
| b37a | Merc | -0.01 | "voice" (-0.02) | as written |
| b43 | Merc | -0.01 | "effortful," (-0.03) | as written |
| b59 | Merc | -0.00 | "time." (-0.00) | as written |

## Listen to these first: a word missing, added or far from the script

A stretch here is missing, added, or under 0.6 alike in its letters, and the scratch take was not heard the same way.

### o2 (Tavi)

- Script: But singers are told to "support" a long note. If that doesn't mean pushing, what keeps it steady?
- As the model spells it: `BUT SINGERS ARE TOLD TO SUPPORT A LONG NOTE IF THAT DOESN'T MEAN PUSHING WHAT KEEPS IT STEADY`
- Heard: `BUT SINGERS ARE TOLD TO S OF FORT A LONG NOTE IF THAT DOESN'T MEAN FUSHING WHAT KEEPS IT STEADY`
- Differs: `SUPPORT` heard as `S OF FORT` (words); `PUSHING` heard as `FUSHING` (spelling)
- Weakest word: ""support"" (-1.21); the line's mean -0.15.

### o3 (Tavi)

- Script: From Lesson 3: how loud should you sing when you practise matching?
- As the model spells it: `FROM LESSON THREE HOW LOUD SHOULD YOU SING WHEN YOU PRACTISE MATCHING`
- Heard: `FROM LETHIN THREE HOW LOUD SHOULD YOU SING WHEN YOU PRACTISE MOUNTING`
- Differs: `LESSON` heard as `LETHIN` (words); `MATCHING` heard as `MOUNTING` (spelling)
- Weakest word: "Lesson" (-1.34); the line's mean -0.22.

### b6 (Merc)

- Script: At about the volume you talk at: a quiet note is just as much the right note.
- As the model spells it: `AT ABOUT THE VOLUME YOU TALK AT A QUIET NOTE IS JUST AS MUCH THE RIGHT NOTE`
- Heard: `AND ABOUT THE VOLUME YOU TALK AT A QUIET NOTE IS JUST AS MUCH THE RIGHT NOTE`
- Differs: `AT` heard as `AND` (words)
- Weakest word: "At" (-0.62); the line's mean -0.09.

### o4 (Tavi)

- Script: If I ease off, does it come back down?
- As the model spells it: `IF I EASE OFF DOES IT COME BACK DOWN`
- Heard: `YE LIKE EAS OFF AN IT COME BACK NOW`
- Differs: `IF I EASE` heard as `YE LIKE EAS` (words); `DOES` heard as `AN` (words); `DOWN` heard as `NOW` (words)
- Weakest word: "If" (-5.37); the line's mean -1.68.

### o5 (Tavi)

- Script: It came back. But Lesson 1 said loud and high are different things. Aren't they?
- As the model spells it: `IT CAME BACK BUT LESSON ONE SAID LOUD AND HIGH ARE DIFFERENT THINGS AREN'T THEY`
- Heard: `IT CAME BACK BUT LOVE IN ONE GLAD LOUD AND FIDE ARE DIFFERENTING ARE THEY`
- Differs: `LESSON` heard as `LOVE IN` (words); `SAID` heard as `GLAD` (words); `HIGH` heard as `FIDE` (words); `DIFFERENT THINGS AREN'T` heard as `DIFFERENTING ARE` (spelling)
- Weakest word: "said" (-2.66); the line's mean -0.60.

### o6 (Tavi)

- Script: Then where does that push come from? Isn't it the diaphragm?
- As the model spells it: `THEN WHERE DOES THAT PUSH COME FROM ISN'T IT THE DIAPHRAGM`
- Heard: `THEN WHERE DOES THAT PUSH COME FROM ISN'T IT THE DIAH FRAMPH`
- Differs: `DIAPHRAGM` heard as `DIAH FRAMPH` (words)
- Weakest word: "diaphragm?" (-1.95); the line's mean -0.22.

### b11 (Merc)

- Script: Your diaphragm is a dome-shaped muscle under your lungs. It tightens to breathe in.
- As the model spells it: `YOUR DIAPHRAGM IS A DOME SHAPED MUSCLE UNDER YOUR LUNGS IT TIGHTENS TO BREATHE IN`
- Heard: `YOUR DIAPHRAM IS A DOME SHAPED MUSCLE UNDER YOUR LUNPS IT TIGHTENS TO BREATHE EN`
- Differs: `DIAPHRAGM` heard as `DIAPHRAM` (spelling, scratch too); `LUNGS` heard as `LUNPS` (spelling); `IN` heard as `EN` (words)
- Weakest word: "in." (-0.69); the line's mean -0.15.

### o7 (Tavi)

- Script: So full lungs push by themselves, and at first I just hold some back.
- As the model spells it: `SO FULL LUNGS PUSH BY THEMSELVES AND AT FIRST I JUST HOLD SOME BACK`
- Heard: `SO FUL LONGS FLUSHED FY THEMSELVES AND AT FIRST I JUST HOLD SOME TAT`
- Differs: `FULL LUNGS PUSH BY` heard as `FUL LONGS FLUSHED FY` (spelling); `BACK` heard as `TAT` (words)
- Weakest word: "back." (-3.91); the line's mean -0.43.

### o8 (Tavi)

- Script: What about "support"? Don't singers mean pushing hard, or squeezing?
- As the model spells it: `WHAT ABOUT SUPPORT DON'T SINGERS MEAN PUSHING HARD OR SQUEEZING`
- Heard: `ABOUT SUPPORT DON'T SINGERS MEAN PUSHING HARD OR SQUEESING`
- Differs: `WHAT` heard as `(nothing)` (words); `SQUEEZING` heard as `SQUEESING` (spelling)
- Weakest word: "What" (-1.16); the line's mean -0.21.

### b18 (Merc)

- Script: Squeezing your throat makes a pressed sound, the sound people make lifting something heavy, and a pressed sound needs more air pressure, not less.
- As the model spells it: `SQUEEZING YOUR THROAT MAKES A PRESSED SOUND THE SOUND PEOPLE MAKE LIFTING SOMETHING HEAVY AND A PRESSED SOUND NEEDS MORE AIR PRESSURE NOT LESS`
- Heard: `SQUEEZING YOUR THROAT MAKES UP PRESSED SOUND THE SOUND PEOPLE MAKE LIFTING SOMETHING HEAVY AND OPPRESSED SOUND NEEDS MORE AIR PRESSURE NOT LESS`
- Differs: `A` heard as `UP` (words); `A PRESSED` heard as `OPPRESSED` (spelling, scratch too)
- Weakest word: "a" (-4.63); the line's mean -0.27.

### b21 (Merc)

- Script: Start tall but easy. If you're standing, keep your knees unlocked. Let your jaw, tongue and neck go loose.
- As the model spells it: `START TALL BUT EASY IF YOU'RE STANDING KEEP YOUR KNEES UNLOCKED LET YOUR JAW TONGUE AND NECK GO LOOSE`
- Heard: `START TALL BHAT EASY IF YOU'RE STANDING KEEP YOUR KNEES ON LOCK LET YOUR JAW TONGU AND NECK GO LOOSE`
- Differs: `BUT` heard as `BHAT` (words); `UNLOCKED` heard as `ON LOCK` (spelling); `TONGUE` heard as `TONGU` (spelling)
- Weakest word: "unlocked." (-0.59); the line's mean -0.11.

### b27a (Merc)

- Script: Back to back now: listen for the puff, then the click, then neither.
- As the model spells it: `BACK TO BACK NOW LISTEN FOR THE PUFF THEN THE CLICK THEN NEITHER`
- Heard: `BACK TO BACK NOW LISTEN FOR THE POT THEN THE CLICK THEN NEITHER`
- Differs: `PUFF` heard as `POT` (words)
- Weakest word: "puff," (-0.84); the line's mean -0.09.

### o11 (Tavi)

- Script: What does a steady note look like? A perfectly straight line?
- As the model spells it: `WHAT DOES A STEADY NOTE LOOK LIKE A PERFECTLY STRAIGHT LINE`
- Heard: `WT A STEADY NOBLE LOOK LIFE A PERFECTLY STRAIGHT LINE`
- Differs: `WHAT DOES` heard as `WT` (words); `NOTE` heard as `NOBLE` (spelling); `LIKE` heard as `LIFE` (spelling)
- Weakest word: "does" (-1.88); the line's mean -0.45.

### b29 (Merc)

- Script: Tavi, hold an A for ten seconds.
- As the model spells it: `TAVI HOLD AN A FOR TEN SECONDS`
- Heard: `TOBVY HOLD AN A FOR TEN SECONDS`
- Differs: `TAVI` heard as `TOBVY` (words)
- Weakest word: "Tavi," (-2.66); the line's mean -0.42.

### o12 (Tavi)

- Script: It scooped, and it waves. Is that still steady?
- As the model spells it: `IT SCOOPED AND IT WAVES IS THAT STILL STEADY`
- Heard: `ITS KOTAND IT FATE IS THAT STILL FTY`
- Differs: `(nothing)` heard as `ITS KOTAND` (words); `SCOOPED AND IT WAVES` heard as `FATE` (words); `STEADY` heard as `FTY` (words)
- Weakest word: "steady?" (-2.27); the line's mean -0.70.

### b32 (Merc)

- Script: Steady means the line settles into the band and stays, for a comfortable, fixed length, never "as long as you can".
- As the model spells it: `STEADY MEANS THE LINE SETTLES INTO THE BAND AND STAYS FOR A COMFORTABLE FIXED LENGTH NEVER AS LONG AS YOU CAN`
- Heard: `STEADYSMEANS THE LINE SETTLES INTO THE BAND AND STADIES FOR A COMFORTABLE FIXED LANK NEVER AS LONG AS YOU CAN`
- Differs: `STEADY MEANS` heard as `STEADYSMEANS` (spelling); `STAYS` heard as `STADIES` (spelling); `LENGTH` heard as `LANK` (words)
- Weakest word: "length," (-1.32); the line's mean -0.11.

### b42 (Merc)

- Script: Breathe in.
- As the model spells it: `BREATHE IN`
- Heard: `BREATHE EM`
- Differs: `IN` heard as `EM` (words)
- Weakest word: "in." (-2.38); the line's mean -1.23.

### b47 (Merc)

- Script: Quick check.
- As the model spells it: `QUICK CHECK`
- Heard: `QUICK TRACK`
- Differs: `CHECK` heard as `TRACK` (words)
- Weakest word: "check." (-1.63); the line's mean -0.82.

### b48 (Merc)

- Script: What is your diaphragm's main job?
- As the model spells it: `WHAT IS YOUR DIAPHRAGM'S MAIN JOB`
- Heard: `WHAT IS YOUR DI OF FRAMS MAIN JOHN`
- Differs: `DIAPHRAGM'S` heard as `DI OF FRAMS` (spelling); `JOB` heard as `JOHN` (words)
- Weakest word: "job?" (-2.76); the line's mean -0.68.

### b55 (Merc)

- Script: Practise it. Voice Mirror has you glide up and down, hold any comfortable note for six seconds, then sing back five notes it plays.
- As the model spells it: `PRACTISE IT VOICE MIRROR HAS YOU GLIDE UP AND DOWN HOLD ANY COMFORTABLE NOTE FOR SIX SECONDS THEN SING BACK FIVE NOTES IT PLAYS`
- Heard: `PRACTISE IT VOICE MERROR HAS YOU GLIDE UP AND DOWN HOLD ANY COMFORTABLE NOTE FOR SIX SECONDS THEN SING BACK FIVE NOTES AT PLAYS`
- Differs: `MIRROR` heard as `MERROR` (spelling); `IT` heard as `AT` (words)
- Weakest word: "it" (-0.92); the line's mean -0.08.

### b58 (Merc)

- Script: Felt uncomfortable, or listened along today? Rest today. Voice Mirror will be here when your voice feels comfortable: mercurypitch dot com slash mirror.
- As the model spells it: `FELT UNCOMFORTABLE OR LISTENED ALONG TODAY REST TODAY VOICE MIRROR WILL BE HERE WHEN YOUR VOICE FEELS COMFORTABLE MERCURYPITCH DOT COM SLASH MIRROR`
- Heard: `FELT UNCOMFORTABLE OR LISTENED ALONG TO DAY REST TO DAY VOICE MERE WILL BE HERE WHEN YOUR VOICE FEELS COMFORTABLE MERCURY PITCH DOT COM SLASH MIRROR`
- Differs: `TODAY` heard as `TO DAY` (spelling, scratch too); `TODAY` heard as `TO DAY` (spelling, scratch too); `MIRROR` heard as `MERE` (words); `MERCURYPITCH` heard as `MERCURY PITCH` (spelling)
- Weakest word: "Mirror" (-2.26); the line's mean -0.14.

### o15 (Tavi)

- Script: Why can you start "Twinkle, Twinkle" on any note and it is still the same tune?
- As the model spells it: `WHY CAN YOU START TWINKLE TWINKLE ON ANY NOTE AND IT IS STILL THE SAME TUNE`
- Heard: `WHY CAN YOU START TWINKLE TWINKLE ON ANY NOTE AND IT IS STILL THE SAME TO`
- Differs: `TUNE` heard as `TO` (words)
- Weakest word: "tune?" (-2.53); the line's mean -0.19.

## Differ in spelling only

Every stretch is near the script's letters, or was heard the same way in the scratch take.

### o1 (Tavi)

- Script: So if I push the air out harder, the note holds steadier?
- As the model spells it: `SO IF I PUSH THE AIR OUT HARDER THE NOTE HOLDS STEADIER`
- Heard: `SO IF I PUSH THE AIR OUT FARTHER THE NOTEFOLD STEADIER`
- Differs: `HARDER` heard as `FARTHER` (spelling); `NOTE HOLDS` heard as `NOTEFOLD` (spelling)
- Weakest word: "harder," (-1.79); the line's mean -0.29.

### b1 (Merc)

- Script: Let's listen: the same note, pushed harder and harder. Will the line settle, steadier than before, or get louder and drift higher?
- As the model spells it: `LET'S LISTEN THE SAME NOTE PUSHED HARDER AND HARDER WILL THE LINE SETTLE STEADIER THAN BEFORE OR GET LOUDER AND DRIFT HIGHER`
- Heard: `LET'S LISTEN THE SAME NOTE PUSHED HARDER AND HARDER WILL THE LINES SETTLED STEADIER THAN BEFORE OR GET LOUDER AND DRIFT HIGHER`
- Differs: `LINE SETTLE` heard as `LINES SETTLED` (spelling)
- Weakest word: "drift" (-0.11); the line's mean -0.03.

### b4 (Merc)

- Script: By the end, you'll know what your diaphragm does, how to breathe in low and start easily, and you'll hold a comfortable note for ten seconds.
- As the model spells it: `BY THE END YOU'LL KNOW WHAT YOUR DIAPHRAGM DOES HOW TO BREATHE IN LOW AND START EASILY AND YOU'LL HOLD A COMFORTABLE NOTE FOR TEN SECONDS`
- Heard: `BY THE END YOU'LL KNOW WHAT YOUR DIAPHRAM DOES HOW TO BREATHE IN LOW AND START EASILY AND YOU'LL HOLD A COMFORTABLE NOTE FOR TEN SECONDS`
- Differs: `DIAPHRAGM` heard as `DIAPHRAM` (spelling)
- Weakest word: "diaphragm" (-0.76); the line's mean -0.07.

### b7 (Merc)

- Script: How hard your breath pushes on your vocal folds is its pressure. It mainly sets how loud the note is, and it nudges the pitch.
- As the model spells it: `HOW HARD YOUR BREATH PUSHES ON YOUR VOCAL FOLDS IS ITS PRESSURE IT MAINLY SETS HOW LOUD THE NOTE IS AND IT NUDGES THE PITCH`
- Heard: `HOW HARD YOUR BREATH PUSHES ON YOUR VOCALFOOLDS IS ITS PRESSURE IT MAINLY SETS HOW LOUD THE NOTE IS AND IT NUDGES THE PITCH`
- Differs: `VOCAL FOLDS` heard as `VOCALFOOLDS` (spelling)
- Weakest word: "folds" (-0.31); the line's mean -0.05.

### b14 (Merc)

- Script: Full lungs spring back by themselves, often harder than a quiet note needs. So at first your breathing-in muscles keep working, holding some of that push back.
- As the model spells it: `FULL LUNGS SPRING BACK BY THEMSELVES OFTEN HARDER THAN A QUIET NOTE NEEDS SO AT FIRST YOUR BREATHING IN MUSCLES KEEP WORKING HOLDING SOME OF THAT PUSH BACK`
- Heard: `FULL LUNGS SPRING BACK BY THEMSELVES OFTEN HARDER THAN A QUIET NOTE NEEDS SO AT FIRST YOURE BREATHING IN MUSCLES KEEP WORKING HOLDING SOME OF THAT PUSH BACK`
- Differs: `YOUR` heard as `YOURE` (spelling)
- Weakest word: "some" (-0.17); the line's mean -0.04.

### b15 (Merc)

- Script: As the air goes, your belly and rib muscles take over the pushing. Your diaphragm can't push air out.
- As the model spells it: `AS THE AIR GOES YOUR BELLY AND RIB MUSCLES TAKE OVER THE PUSHING YOUR DIAPHRAGM CAN'T PUSH AIR OUT`
- Heard: `AS THE AIR GOES YOUR BELLY AND RIBMUSCLES TAKE OVER THE PUSHING YOUR DIAPHRAM CAN'T PUSH AIROUT`
- Differs: `RIB MUSCLES` heard as `RIBMUSCLES` (spelling); `DIAPHRAGM` heard as `DIAPHRAM` (spelling, scratch too); `AIR OUT` heard as `AIROUT` (spelling)
- Weakest word: "diaphragm" (-0.44); the line's mean -0.06.

### b17 (Merc)

- Script: That's a common mix-up. Pushing moves the note, as you heard.
- As the model spells it: `THAT'S A COMMON MIX UP PUSHING MOVES THE NOTE AS YOU HEARD`
- Heard: `THAT'S A COMMON MIX UP HUSHING MOVES THE NOTE AS YOU HEARD`
- Differs: `PUSHING` heard as `HUSHING` (spelling)
- Weakest word: "Pushing" (-0.15); the line's mean -0.04.

### b19 (Merc)

- Script: "Support" is singers' word for how they manage the breath as they sing. There's no one agreed meaning.
- As the model spells it: `SUPPORT IS SINGERS WORD FOR HOW THEY MANAGE THE BREATH AS THEY SING THERE'S NO ONE AGREED MEANING`
- Heard: `SUPPORT IS SINGER'S WORD FOR HOW THEY MANAGED THE BRAT AS THEY SANG THERE IS NO ONE AGREED MEANING`
- Differs: `SINGERS` heard as `SINGER'S` (spelling, scratch too); `MANAGE` heard as `MANAGED` (spelling); `BREATH` heard as `BRAT` (spelling); `SING THERE'S` heard as `SANG THERE IS` (spelling)
- Weakest word: "breath" (-0.92); the line's mean -0.11.

### o10 (Tavi)

- Script: And how should the note start?
- As the model spells it: `AND HOW SHOULD THE NOTE START`
- Heard: `AND HOW SHOULD THE NOTE DART`
- Differs: `START` heard as `DART` (spelling)
- Weakest word: "start?" (-0.83); the line's mean -0.17.

### b24 (Merc)

- Script: How a note starts is its onset. A voice has three main ways. Just listen.
- As the model spells it: `HOW A NOTE STARTS IS ITS ONSET A VOICE HAS THREE MAIN WAYS JUST LISTEN`
- Heard: `HOW A NOTE STARTS IS ITS ONSED A VOICE HAS THREE MAIN WAYS JUST LISTEN`
- Differs: `ONSET` heard as `ONSED` (spelling)
- Weakest word: "onset." (-0.24); the line's mean -0.05.

### b25 (Merc)

- Script: Air first: a puff of breath, like a soft "h", then the sound.
- As the model spells it: `AIR FIRST A PUFF OF BREATH LIKE A SOFT H THEN THE SOUND`
- Heard: `AIR FIRST A PUFF OF BREATH LIKE A SOFT HU THEN THE SOUND`
- Differs: `H` heard as `HU` (spelling)
- Weakest word: ""h"," (-0.64); the line's mean -0.09.

### b26 (Merc)

- Script: A catch: the vocal folds are pressed shut, and the note starts as they open, a little like a cough.
- As the model spells it: `A CATCH THE VOCAL FOLDS ARE PRESSED SHUT AND THE NOTE STARTS AS THEY OPEN A LITTLE LIKE A COUGH`
- Heard: `A CATCH THE VOCAL FONES ARE PRESSED SHOT AND THE NOTE STARTS AS THEY OPEN A LITTLE LIKE A COUGH`
- Differs: `FOLDS` heard as `FONES` (spelling); `SHUT` heard as `SHOT` (spelling)
- Weakest word: "folds" (-1.35); the line's mean -0.16.

### b30 (Merc)

- Script: It is. Sung notes are rarely perfectly still: they can begin with a short slide, a scoop.
- As the model spells it: `IT IS SUNG NOTES ARE RARELY PERFECTLY STILL THEY CAN BEGIN WITH A SHORT SLIDE A SCOOP`
- Heard: `IT IS SOME NOTES ARE RARELY PERFECTLY STILL THEY CAN BEGIN WITH A SHORT SLIDE A SCOOP`
- Differs: `SUNG` heard as `SOME` (words, scratch too)
- Weakest word: "Sung" (-4.07); the line's mean -0.29.

### b31 (Merc)

- Script: And steady doesn't mean dead straight: a small vibrato, a regular wave in the pitch, can sit inside the band.
- As the model spells it: `AND STEADY DOESN'T MEAN DEAD STRAIGHT A SMALL VIBRATO A REGULAR WAVE IN THE PITCH CAN SIT INSIDE THE BAND`
- Heard: `AND STEADY DOESN'T MEAN DEAD STRAIGHT A SMALL VIBRODO A REGULAR WAVE IN THE PITCH AND SIT INSIDE THE BAND`
- Differs: `VIBRATO` heard as `VIBRODO` (spelling); `CAN` heard as `AND` (spelling)
- Weakest word: "can" (-0.84); the line's mean -0.09.

### b34 (Merc)

- Script: Your turn: one comfortable note, held for ten seconds.
- As the model spells it: `YOUR TURN ONE COMFORTABLE NOTE HELD FOR TEN SECONDS`
- Heard: `YOUR TURN ONE COMFORTABLE NOTE HELD FOR TEN SECONDSS`
- Differs: `SECONDS` heard as `SECONDSS` (spelling)
- Weakest word: "turn:" (-0.23); the line's mean -0.07.

### b35 (Merc)

- Script: Lesson 3's care lines still apply: stop if your voice feels scratchy or hoarse.
- As the model spells it: `LESSON THREE'S CARE LINES STILL APPLY STOP IF YOUR VOICE FEELS SCRATCHY OR HOARSE`
- Heard: `LESSON THREES CAROLINE STILL APPLY STOP IF YOUR VOICE FEEL SCRATCHY OR HORSE`
- Differs: `THREE'S CARE LINES` heard as `THREES CAROLINE` (spelling); `FEELS` heard as `FEEL` (spelling); `HOARSE` heard as `HORSE` (spelling)
- Weakest word: "care" (-1.10); the line's mean -0.17.

### b36 (Merc)

- Script: Sore, hoarse or unwell today? Just listen along.
- As the model spells it: `SORE HOARSE OR UNWELL TODAY JUST LISTEN ALONG`
- Heard: `SORE COARSE OR UNWELL TO DAY JUST LISTEN ALONG`
- Differs: `HOARSE` heard as `COARSE` (spelling); `TODAY` heard as `TO DAY` (spelling, scratch too)
- Weakest word: "hoarse" (-0.37); the line's mean -0.08.

### b37 (Merc)

- Script: Choose listening if anything hurts or singing has felt uncomfortable, if your voice feels unusually hoarse or tired, if notes you usually reach have suddenly gone, if you're ill, or if talking or singing feels like hard work today.
- As the model spells it: `CHOOSE LISTENING IF ANYTHING HURTS OR SINGING HAS FELT UNCOMFORTABLE IF YOUR VOICE FEELS UNUSUALLY HOARSE OR TIRED IF NOTES YOU USUALLY REACH HAVE SUDDENLY GONE IF YOU'RE ILL OR IF TALKING OR SINGING FEELS LIKE HARD WORK TODAY`
- Heard: `CHOOSE LISTENING IF ANYTHING HURTS OR SINGING HAS FELT UNCOMFORTABLIF YOUR VOICE FEELS UNUSUALLY HOARSE OR TIRED IF NOTES YOU USUALLY REACH HAVE SUDDENLY GONE IF YOU'RE ILL OR IF TALKING OR SINGING FEELS LIKE HARD WORK TO DAY`
- Differs: `UNCOMFORTABLE IF` heard as `UNCOMFORTABLIF` (spelling); `TODAY` heard as `TO DAY` (spelling, scratch too)
- Weakest word: "you're" (-0.18); the line's mean -0.04.

### b38 (Merc)

- Script: Otherwise, sing my A, or Tavi's, an octave up.
- As the model spells it: `OTHERWISE SING MY A OR TAVI'S AN OCTAVE UP`
- Heard: `OTHERWISE SING MY A OR TABVIES AN OCTIVE AP`
- Differs: `TAVI'S` heard as `TABVIES` (spelling); `OCTAVE UP` heard as `OCTIVE AP` (spelling)
- Weakest word: "up." (-2.16); the line's mean -0.38.

### b39 (Merc)

- Script: Listen to our note. Breathe in, low and quiet. Then sing straight away, easily, at about speaking volume.
- As the model spells it: `LISTEN TO OUR NOTE BREATHE IN LOW AND QUIET THEN SING STRAIGHT AWAY EASILY AT ABOUT SPEAKING VOLUME`
- Heard: `LISTEN TO OUR NOTE BREATHE IN LO AND QUIET THEN SING STRAIGHTAWAY EASILY AT ABOUT SPEAKING VOLUME`
- Differs: `LOW` heard as `LO` (spelling); `STRAIGHT AWAY` heard as `STRAIGHTAWAY` (spelling)
- Weakest word: "low" (-0.30); the line's mean -0.05.

### b44 (Merc)

- Script: Easy or workable? Rest for a few easy breaths.
- As the model spells it: `EASY OR WORKABLE REST FOR A FEW EASY BREATHS`
- Heard: `EASY OR WORKABLE REST FOR A FEW EASY BRASS`
- Differs: `BREATHS` heard as `BRASS` (spelling)
- Weakest word: "breaths." (-1.30); the line's mean -0.17.

### b45 (Merc)

- Script: Effortful? Keep it gentle: rest before you sing again.
- As the model spells it: `EFFORTFUL KEEP IT GENTLE REST BEFORE YOU SING AGAIN`
- Heard: `EFFORTFULK KEEP IT GENTLE REST BEFORE YOU SING AGAIN`
- Differs: `EFFORTFUL` heard as `EFFORTFULK` (spelling)
- Weakest word: "before" (-0.11); the line's mean -0.03.

### b46 (Merc)

- Script: Uncomfortable? Thanks for saying so. That's enough singing for today: rest your voice.
- As the model spells it: `UNCOMFORTABLE THANKS FOR SAYING SO THAT'S ENOUGH SINGING FOR TODAY REST YOUR VOICE`
- Heard: `UNCOMFORTABLE THANKS FOR SAYING SO THAT'S ENOUGH SINGING FOR TO DAY REST YOUR VOICE`
- Differs: `TODAY` heard as `TO DAY` (spelling)
- Weakest word: "for" (-0.11); the line's mean -0.03.

### b46a (Merc)

- Script: Whatever you chose: if hoarseness or discomfort lasts more than a couple of weeks, see a doctor (a GP or an ear, nose and throat specialist). If it's very painful, or breathing or swallowing is hard, get help straight away.
- As the model spells it: `WHATEVER YOU CHOSE IF HOARSENESS OR DISCOMFORT LASTS MORE THAN A COUPLE OF WEEKS SEE A DOCTOR A GP OR AN EAR NOSE AND THROAT SPECIALIST IF IT'S VERY PAINFUL OR BREATHING OR SWALLOWING IS HARD GET HELP STRAIGHT AWAY`
- Heard: `WHATEVER YOU CHOSE IF FORCENESS OR DISCOMFORTLASTS MORE THAN A COUPLE OF WEEKS SEE A DOCTOR A G P OR AN EAR KNOWS AND THROAT SPECIALIST IF IT'S VERY PAINFUL OR BREATHING OR SWALLOWING IS HARD GET HELP STRAIGHT AWAY`
- Differs: `HOARSENESS` heard as `FORCENESS` (spelling); `DISCOMFORT LASTS` heard as `DISCOMFORTLASTS` (spelling); `GP` heard as `G P` (spelling); `NOSE` heard as `KNOWS` (spelling)
- Weakest word: "hoarseness" (-0.66); the line's mean -0.06.

### b51 (Merc)

- Script: For a long, easy note, which start do many singing teachers aim for?
- As the model spells it: `FOR A LONG EASY NOTE WHICH START DO MANY SINGING TEACHERS AIM FOR`
- Heard: `FOR A LONG EASY NOTE WHICH STAR DO MANY SINGING TEACHERS AIM FOR`
- Differs: `START` heard as `STAR` (spelling)
- Weakest word: "start" (-0.38); the line's mean -0.05.

### o14a (Tavi)

- Script: What does a steady long note look like on the pitch line?
- As the model spells it: `WHAT DOES A STEADY LONG NOTE LOOK LIKE ON THE PITCH LINE`
- Heard: `WHAT DOES A STETTY LONG NOTE LOOK LIKE ON THE PITS LINE`
- Differs: `STEADY` heard as `STETTY` (spelling); `PITCH` heard as `PITS` (spelling)
- Weakest word: "pitch" (-1.87); the line's mean -0.31.

### b56 (Merc)

- Script: Keep the glides comfortable. Sore, hoarse or unwell today? Just listen along. Free, no account: mercurypitch dot com slash mirror.
- As the model spells it: `KEEP THE GLIDES COMFORTABLE SORE HOARSE OR UNWELL TODAY JUST LISTEN ALONG FREE NO ACCOUNT MERCURYPITCH DOT COM SLASH MIRROR`
- Heard: `KEEP THE GLIDES COMFORTABLE SORE HOARSE OR UNWELL TO DAY JUST LISTEN ALONG FREE NO ACCOUNT MERCURY PITCH DOT COM SLASH MIRROR`
- Differs: `TODAY` heard as `TO DAY` (spelling, scratch too); `MERCURYPITCH` heard as `MERCURY PITCH` (spelling)
- Weakest word: "com" (-0.24); the line's mean -0.04.

