// ============================================================
// Studio capture input — how the recorder worklet hears what it is given: one channel, a wider input folded to it
// ============================================================
//
// Kept apart from capture-node.ts, which loads the worklet's module, so a
// browser test can give these same settings to a node of its own and hear
// what a take keeps (src/e2e/studio-lane-input.spec.ts). A lane's one
// channel arrives as a mono node and passes as it is. A wider input is
// folded by Web Audio's speaker rules, which mix only stereo, quad and 5.1
// (5.1 weighted, its LFE left out): any other count keeps its first channel
// alone, so "all inputs, mixed" mixes them only on those three.
export const STUDIO_CAPTURE_INPUT = {
  channelCount: 1,
  channelCountMode: 'explicit',
  channelInterpretation: 'speakers',
} as const satisfies Pick<
  AudioNodeOptions,
  'channelCount' | 'channelCountMode' | 'channelInterpretation'
>
