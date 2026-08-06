export interface PullOption {
  id: string
  label: string
  moment: string
  suggestions: readonly string[]
}

export const pullOptions: readonly PullOption[] = [
  {
    id: 'scrolling',
    label: 'Another scroll',
    moment: 'When the feed keeps going after you meant to leave.',
    suggestions: [
      'Put the phone in another room.',
      'Play one guitar riff.',
      'Walk to the end of the street.',
    ],
  },
  {
    id: 'snacking',
    label: 'Automatic snacking',
    moment: 'When reaching for something happens before choosing it.',
    suggestions: [
      'Fill a glass of water.',
      'Make a cup of tea.',
      'Step outside for three minutes.',
    ],
  },
  {
    id: 'alcohol-ritual',
    label: 'The familiar drink ritual',
    moment: 'When the usual time or place starts the routine.',
    suggestions: [
      'Pour something alcohol-free.',
      'Pick up the guitar for one riff.',
      'Take a short walk around the block.',
    ],
  },
  {
    id: 'smoking-vaping',
    label: 'The smoking or vaping moment',
    moment: 'When your hands begin the familiar sequence.',
    suggestions: [
      'Hold a cold glass of water.',
      'Walk one block.',
      'Send one message to someone you like.',
    ],
  },
  {
    id: 'takeaway',
    label: 'The automatic takeaway',
    moment: 'When ordering feels easier than making one small thing.',
    suggestions: [
      'Prepare one meal component.',
      'Open the fridge and choose one ingredient.',
      'Fill a glass of water first.',
    ],
  },
  {
    id: 'avoidance',
    label: 'Putting the thing off',
    moment: 'When circling the task takes over from beginning it.',
    suggestions: [
      'Open the file and write one line.',
      'Work for two quiet minutes.',
      'Put the first needed object on the table.',
    ],
  },
]

export const cuePhrases = [
  'A small turn still changes the direction.',
  'One small next choice is enough.',
  'Your attention is yours to place.',
  'Make room for what you chose.',
] as const

export const bSideAcknowledgements = [
  'The turn is yours now.',
  'Good. Let the screen go quiet.',
  'Coming back matters.',
] as const

export const notNowAcknowledgements = [
  'All right. The next cue will still be here.',
  'Nothing to make up. Your next cue is enough.',
] as const
