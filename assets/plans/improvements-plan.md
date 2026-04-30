# Improvements

## Issue 1
- The Sidebar playback setup:
- The octave and scale should change ONLY VIEW, not the actual melody. So if melody needs to be transposed, it needs to be done
  in a separate variable/state which is viewMelody state, and handled by the playback component. Do not actually change the user melody.
- When in Editor tab, the melody can actually be changed via octave and scale dropdown -> that is fine!
- Make the Sidebar playback items for octave and scale NICER, with styling appropriate as to the rest of app (as we did for SharedToolbar practice modes)

## Issue 2
- The Change Once Practice Tab Playback Mode
  The 'Once' playback mode aka 'button' switch should be renamed to 'Spaced' which will work as follows:

The Playback is still once, but the melody is changed depending on the dropdown setting:

Dropdown settings:

    'None' - Means the melody is played as is, similar to 'once' mode, no changes to how the playback looks or works
    Fourth - Means the melody is adjuster prior to putting its note to the play area such that after every note, an rest is laid out, in accordance to setting 'fourth' the rest last for 1/4 of the Bar.
    Half - Same as 'Fourth' but the rest between each note last 2/4 of the full note / bar
    Full - Same a 'Fourth' and 'Half' but the rest between each note lasts 1 full bar additionally.

So, for example if we have notes: C, D, G, the final melody on setting 'Full' would be:

C, Rest (1 Bar), G, Rest (1 Bar), D (1 Bar).

Make the dropdown and mode naming visually similar as other styles we already have for 'Repeat' and 'Session'/'Practice' modes.

The Dropdown entries can have an small nice 'rest' icon in front of 'Fourth', 'Half' and 'Full' text. Or perhaps the rest + how long 'note symbols for the durations).

Playback area in Practice tab should use similar style 'rest' notes to visually present the 'rests' as they are not part of the melody itself.
See SessionEditor SessionTimelne in Editor tab for how this might be neatly presented or make it even better.

Plan this and then execute the plan.

## Issue 3

- The playlist implementation was botched by slow AI, please fix and make it nice as below instructions: so its half implemented
- The list of melodies to add to playlist is not right, can we make some neat, according to current app styles pills view/selector so
  that multi-select can be used for selecting which items are in playlist. Btw. we should only sessions,
  for now playlist can contain only those. Thanks. Check the MediaLibrary / Library modal for the
  Playlist section and this little 'edit' button shows the list of something but isn't right
- If you can make both melodies and sessions be addable to playlist even better!