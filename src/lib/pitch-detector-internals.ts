// The detector internals now live in @irchiinnuss/pitch-engine.
// This shim is left so the import sites did not have to move in the same
// change that collapsed the fork; the sweep that repoints them deletes it.

export {
  adjustedThreshold,
  mpmPickThreshold,
  parabolicInterpolation,
  parabolicInterpolationMax,
} from '@irchiinnuss/pitch-engine/pitch-detector-internals'
