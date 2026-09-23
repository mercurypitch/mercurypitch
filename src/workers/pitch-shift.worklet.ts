// ============================================================
// Pitch-shift worklet — registers the Signalsmith Stretch processor
// ============================================================
//
// The package is both the main-thread API and the worklet body: evaluated
// inside AudioWorkletGlobalScope it calls registerProcessor('signalsmith-stretch').
// Loading it through ?worker&url keeps the processor on our own origin —
// the library's fallback builds a blob: URL from stringified code.
//
// The live-input shim goes first: it has to be in place before the library
// registers, so that an idle shifter is fed silence (see its header).
import './pitch-shift-live-input'
import 'signalsmith-stretch'
