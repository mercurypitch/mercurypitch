// ============================================================
// Studio capture input — how the recorder worklet hears what it is given: one channel
// ============================================================
//
// Kept apart from capture-node.ts, which loads the worklet's module, so a
// browser test can give these same settings to a node of its own and hear
// what a take keeps (src/e2e/studio-lane-input.spec.ts). A lane hands the
// worklet one mono node of its own choosing (lane-channel.ts): one input,
// or an aligned pair at half each, so nothing here mixes. Web Audio's
// speaker fold, which mixes only stereo, quad and 5.1 and keeps the first
// channel of any other count, is left only for an input whose browser does
// not say how many channels it has; there it gives a stereo input's two
// sides at half each, as the Studio's own default would.
export const STUDIO_CAPTURE_INPUT = {
  channelCount: 1,
  channelCountMode: 'explicit',
  channelInterpretation: 'speakers',
} as const satisfies Pick<
  AudioNodeOptions,
  'channelCount' | 'channelCountMode' | 'channelInterpretation'
>
