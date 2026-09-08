# Basic Pitch model

Unmodified Spotify Basic Pitch `icassp_2022/nmp.onnx`, bundled for explicit,
local post-recording chord refinement. No recording is uploaded.

- Upstream: https://github.com/spotify/basic-pitch
- Commit: `fa5997af0a8210982619003269994a1be25eddf3`
- Source: https://raw.githubusercontent.com/spotify/basic-pitch/fa5997af0a8210982619003269994a1be25eddf3/basic_pitch/saved_models/icassp_2022/nmp.onnx
- Bytes: `230444`
- SHA-256: `2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec`
- License: Apache-2.0. The upstream `LICENSE` and `NOTICE` are preserved alongside the model.

The worker also self-hosts ONNX Runtime's WASM binary from the exact installed
`onnxruntime-web` package (currently 1.26.0). Its MIT license is preserved in
`ONNX-RUNTIME-LICENSE` and its upstream notices in
`ONNX-RUNTIME-THIRD-PARTY-NOTICES.txt` from tag `v1.26.0`; binary emission is
handled by Vite, not a second CDN/version download.

The model is upstream; the bounded onset/sustain decoder is MercuryPitch's
`mp-basic-pitch-hysteresis/1`, not a claim of upstream decoder parity.
See `docs/guitar-chord-refinement.md` for measured quality limitations.
