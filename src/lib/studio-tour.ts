// Studio tour — mounted library and arrangement controls, without changing the song.

export interface StudioTourStep {
  title: string
  targetSelector: string
  description: string
  placement: 'bottom' | 'top'
  whenPresent?: true
}

export const STUDIO_LIBRARY_TOUR_STEPS: StudioTourStep[] = [
  {
    title: 'Your songs',
    targetSelector: '[data-tour="studio.library"]',
    description:
      'Studio keeps your projects in this browser. Open a song to continue arranging its takes.',
    placement: 'bottom',
  },
  {
    title: 'Start a song',
    targetSelector: '[data-tour="studio.new-song"]',
    description:
      'Start with an empty arrangement, then add recorded takes from the app or audio files from your device.',
    placement: 'bottom',
  },
  {
    title: 'Open a backup',
    targetSelector: '[data-tour="studio.open-backup"]',
    description:
      'A Studio backup includes the arrangement and its audio. Opening one creates a new project and keeps your existing songs.',
    placement: 'bottom',
  },
  {
    title: 'Keep a copy',
    targetSelector: '[data-tour="studio.local-note"]',
    description:
      'Browser storage can be cleared. Download a song backup from Song options to keep a copy elsewhere.',
    placement: 'top',
  },
]

export const STUDIO_WORKSPACE_TOUR_STEPS: StudioTourStep[] = [
  {
    title: 'Song options',
    targetSelector: '[data-tour="studio.song-options"]',
    description:
      'Name this song, download a complete backup, make a copy, or return to your song library. Changes save in this browser.',
    placement: 'bottom',
    whenPresent: true,
  },
  {
    title: 'Bring in your takes',
    targetSelector: '[data-tour="studio.add-takes"]',
    description:
      'Preview saved vocal and instrument recordings, or choose an audio file. Add puts a copy in this song at the playhead.',
    placement: 'bottom',
    whenPresent: true,
  },
  {
    title: 'Choose your view',
    targetSelector: '[data-tour="studio.view-controls"]',
    description:
      'Use seconds or beats on the ruler, and zoom in for close edits. Tempo changes the beat reference; it does not stretch the audio.',
    placement: 'bottom',
    whenPresent: true,
  },
  {
    title: 'Line things up',
    targetSelector: '[data-tour="studio.snap"]',
    description:
      'Snap helps clips meet the ruler, playhead or another clip edge. Hold Alt during a drag to place the clip freely.',
    placement: 'bottom',
    whenPresent: true,
  },
  {
    title: 'Arrange the song',
    targetSelector: '[data-tour="studio.timeline"]',
    description:
      'Select a clip to move, trim or fade it. Details gives exact values; Split cuts at the playhead. Clips need free space in a lane, or you can drag to New lane.',
    placement: 'top',
    whenPresent: true,
  },
  {
    title: 'Follow the song',
    targetSelector: '[data-tour="studio.timeline-overview"]',
    description:
      'Scroll through the arrangement and tap the ruler to listen from another position. Move, trim and fade clips on a tablet or computer.',
    placement: 'top',
    whenPresent: true,
  },
  {
    title: 'Balance each track',
    targetSelector: '[data-tour="studio.track-controls"]',
    description:
      'Set the volume and left-right balance for a track. Mute leaves it out; Solo lets you hear it on its own.',
    placement: 'bottom',
    whenPresent: true,
  },
  {
    title: 'Mix on your phone',
    targetSelector: '[data-tour="studio.mix"]',
    description:
      'Open Mix for each track’s volume, pan, mute and solo controls while you listen.',
    placement: 'bottom',
    whenPresent: true,
  },
  {
    title: 'Try an edit',
    targetSelector: '[data-tour="studio.history"]',
    description:
      'Undo reverses your last edit and Redo brings it back. The button names tell you which edit comes next.',
    placement: 'bottom',
    whenPresent: true,
  },
  {
    title: 'Listen',
    targetSelector: '[data-tour="studio.transport"]',
    description:
      'Play and pause the song, return to the start, or repeat the arrangement. Playback starts only when you press Play.',
    placement: 'top',
    whenPresent: true,
  },
  {
    title: 'Shape the sound',
    targetSelector: '[data-tour="studio.sound"]',
    description:
      'Choose a sound, adjust the mix controls and set the master loudness. Auto-balance gives the tracks a starting balance you can change.',
    placement: 'bottom',
    whenPresent: true,
  },
  {
    title: 'Export the song',
    targetSelector: '[data-tour="studio.export"]',
    description:
      'Render a WAV of the whole song and check its loudness and peak measurements before downloading. Keep a Studio backup as well if you want to edit it later.',
    placement: 'bottom',
    whenPresent: true,
  },
]

export function studioTourSteps(hasWorkspace: boolean): StudioTourStep[] {
  return hasWorkspace ? STUDIO_WORKSPACE_TOUR_STEPS : STUDIO_LIBRARY_TOUR_STEPS
}
