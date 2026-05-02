Propose a simpler solution to have just one Playback which has a state, which is passed down onto components, and has callbacks, functinality in its scope that can be called, to start/pause/stop etc. playback.
You can also add audio handling callbacks if they are needed.

THe Editor Tab/Component (piano roll) then calls Play/Pause when nedeed, e.g., playhead moves etc. and calls audio engine to play notes ofc.
The Practice Tab Component: Is the main session and melody player, and it can separately also call the audio notes and as desired to play/pause/stop the playback.

IF we need to separate this states, then create two instances of this 'object', and send each tab its own instance.
The API between musical notes and playback should be straighforward I suppose.

When you plan this let me know of any issues, analyze the current state deeply and lets fix this once and for all.

Additional found issues, address one by one:

    The play-head is simply not moving in Practice tab. When user clicks "Play" button, and no audio is playing. But the session time is going...
    The Record mode is not doing anything when in Editor tab, I click Record (the mic is auto-enabled, ok) then I should be able to click Play and the notes from Mic should be fetched and recorded to the currently selected melody (note the user of overwrite if the melody already has notes at that position (once, on play start). The undo/redo should help here if accidently notes were to be overwritten. But yeah the record process should map microphone notes and create them in Editor piano roll component for later editing or playback. The audio of existing Melody notes should not play at that time (at least in general, for now).
    The Focus mode doesn't work as well, as the playhead is also stuck at beginning
    Check where did the play dot dissapear, the glowing dot should also follow notes. And in focus mode an animation of jumping across one to another note implemented (yousician application style, if you can mimick it)
