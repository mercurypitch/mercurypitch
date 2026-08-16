export interface PullOption {
  id: string
  label: string
  moment: string
  suggestions: readonly string[]
}

export const pullOptions: readonly PullOption[] = [
  {
    id: 'scrolling',
    label: 'Endless scrolling',
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
    id: 'familiar-ritual',
    label: 'The familiar ritual',
    moment: 'When the usual time or place starts the routine.',
    suggestions: [
      'Pour a glass of water.',
      'Put on one song you like.',
      'Take a short walk around the block.',
    ],
  },
  {
    id: 'two-minute-pause',
    label: 'The two-minute pause',
    moment: 'When you reach for a familiar pause before choosing it.',
    suggestions: [
      'Take six slow breaths.',
      'Stand by an open window for two minutes.',
      'Send one message to someone you like.',
    ],
  },
  {
    id: 'one-tap-convenience',
    label: 'One-tap convenience',
    moment: 'When one tap starts to feel like the easiest answer.',
    suggestions: [
      'Wait five minutes before opening checkout.',
      'Write down what you were about to order.',
      'Move it to a later list first.',
    ],
  },
  {
    id: 'avoidance',
    label: 'Putting it off',
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
