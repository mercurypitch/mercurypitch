# P2P Music Jam Service — Implementation Plan

Issue: [#276](https://github.com/Komediruzecki/pitch-perfect/issues/276)

## Overview

Real-time P2P music jamming integrated into PitchPerfect. Musicians connect directly via WebRTC, streaming low-latency audio so they can play together remotely. A lightweight signaling server (Cloudflare Workers + Durable Objects) brokers peer connections; all audio flows peer-to-peer.

## Research Questions (from issue)

1. What are the downsides of currently offered services?
2. What is the best option for seamless integration and lowest latency?
3. If P2P is best, how difficult is it to integrate into PitchPerfect?
4. Define effort, scope, MWE (Minimal Working Example).

## Technology Landscape

### Existing Jam Platforms

| Platform | Architecture | Latency | Integration Cost | Notes |
|----------|-------------|---------|------------------|-------|
| Jamulus | Native client-server | ~20-40ms | High (native only) | Open source, requires dedicated server |
| Soundjack | Browser P2P (WebRTC) | ~10-30ms | Medium (proprietary) | Commercial, browser-based |
| Jammr | P2P (custom protocol) | ~15-35ms | Medium | Commercial, has free tier |
| SonoBus | Native P2P (JUCE) | ~10-25ms | High (native only) | Open source, excellent quality |
| Jamtaba | Native client-server | ~30-50ms | High (native only) | Open source, Ninjam-based |

### Downsides of Existing Services

- **Native apps only**: Most require desktop installation — no browser-based option that integrates into an existing web app like PitchPerfect.
- **Closed ecosystems**: User must leave PitchPerfect, use separate app, no shared state (melodies, sessions).
- **Server dependency**: Jamulus/SonoBus require running a server somewhere — not "just work" UX.
- **No shared musical context**: None share MIDI melodies, session state, or practice context between peers.

### Why P2P (WebRTC) Is the Best Option for PitchPerfect

1. **Zero server audio cost** — audio never touches our infra, only signaling metadata (~bytes per message).
2. **Browser-native** — WebRTC is built into all modern browsers; no plugin or install.
3. **Lowest possible latency** — direct peer-to-peer, no server hop adding RTT.
4. **Integrates with Web Audio API** — PitchPerfect already uses `AudioContext`; can pipe remote streams directly into existing audio graph.
5. **Cloudflare-compatible signaling** — Workers for lightweight signaling, Durable Objects for room state.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PitchPerfect Client A                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Mic Capture  │→ │  Audio Engine │→ │  WebRTC PeerConnection   │  │
│  │  (MediaStream)│  │  (Opus encode)│  │  (P2P audio track)        │  │
│  └──────────────┘  └──────────────┘  └──────────┬───────────────┘  │
│                                                  │                   │
│  ┌──────────────┐  ┌──────────────┐             │                   │
│  │  Remote Audio│← │  Audio Engine │←──────────── (P2P)             │
│  │  (output)    │  │  (Opus decode)│                                  │
│  └──────────────┘  └──────────────┘                                  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Jam Session UI                                               │   │
│  │  • Create/join rooms  • Participant list  • Latency indicator │   │
│  │  • Mute/solo per peer  • Shared MIDI view  • Chat             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                    WebSocket (signaling only)
                               │
                    ┌──────────┴──────────┐
                    │   Cloudflare Edge    │
                    │  ┌────────────────┐  │
                    │  │   Worker       │  │
                    │  │  (REST: rooms) │  │
                    │  └───────┬────────┘  │
                    │          │           │
                    │  ┌───────┴────────┐  │
                    │  │ Durable Object  │  │
                    │  │ (room state +   │  │
                    │  │  signaling relay)│  │
                    │  └────────────────┘  │
                    └──────────────────────┘
```

### Signaling Flow

```
Peer A              Signaling Server (DO)           Peer B
  │                         │                          │
  │── createRoom() ────────→│                          │
  │←── roomId ──────────────│                          │
  │                         │                          │
  │                         │←── joinRoom(roomId) ─────│
  │←── "peer-joined" ───────│── "peer-joined" ────────→│
  │                         │                          │
  │── SDP offer ───────────→│── SDP offer ────────────→│
  │←── SDP answer ──────────│←── SDP answer ───────────│
  │                         │                          │
  │── ICE candidate ───────→│── ICE candidate ────────→│
  │←── ICE candidate ───────│←── ICE candidate ────────│
  │                         │                          │
  │══════════ P2P Audio Stream (Opus) ════════════════│
  │                         │                          │
```

## Cloudflare Infrastructure

### Why Cloudflare Workers + Durable Objects

- **Already on Cloudflare** (per user: "I already have domain, workers etc on my Cloudflare account")
- **Durable Objects** provide WebSocket-based room state with exactly-once semantics — ideal for signaling relay
- **Zero cold start** for active rooms (DO stays warm)
- **Pricing**: Durable Object ~$0.15/million requests + $0.00015/GB-sec. For signaling traffic, 1000 active jam hours/month ≈ ~$2-5/month
- **No new infra**: No need for separate signaling server, no VPS, no Kubernetes

### Worker Endpoints

```
POST   /api/jam/rooms              — Create a new jam room
GET    /api/jam/rooms/:id          — Get room info (peer count, metadata)
DELETE /api/jam/rooms/:id          — Close room (owner only)
WS     /api/jam/rooms/:id/signal   — WebSocket upgrade → Durable Object for signaling
```

### Durable Object — RoomState

```
class JamRoom extends DurableObject {
  // Persistent: room ID, owner, participant list, shared melody ref
  // Ephemeral: WebSocket connections, active SDP/ICE relay
  // Lifecycle: auto-deleted after last peer leaves + 5 min grace
}
```

## P2P Audio Considerations

### Codec: Opus

- Built into WebRTC, optimized for voice AND music
- Configurable bitrate: 32-510 kbps
- For music quality: target 128-256 kbps
- **Critical**: Disable browser echo cancellation (`echoCancellation: false`), noise suppression, and auto-gain-control on the `MediaStreamTrack` — these distort musical audio

### Latency Budget

| Component | Target |
|-----------|--------|
| Audio capture (mic) | ~2-5ms |
| Opus encode | ~2-5ms |
| Network RTT (same region) | ~5-20ms |
| Jitter buffer | ~5-20ms |
| Opus decode | ~2-5ms |
| Audio output | ~2-5ms |
| **Total** | **~20-60ms** |

Target: sub-50ms for same-region peers, acceptable up to 100ms cross-region.

### Synchronization

- **Not attempting** sample-accurate sync — that requires NTP + clock drift compensation and is a research-grade problem
- Peer audio is mixed with local audio; slight offset is musically acceptable for practice jams
- Optional: metronome click shared via DataChannel for beat alignment (±10ms)

## Integration into PitchPerfect

### New Components

```
src/
├── components/
│   ├── JamPanel.tsx              # Main jam UI (create, join, session, video, chat)
│   ├── JamPeerList.tsx           # Connected peers with status indicators
│   ├── JamInviteModal.tsx        # Share room link / code
│   └── index.ts                  # Export all jam components
├── lib/
│   ├── jam-service.ts            # WebRTC: peer connections, video, DataChannel chat
│   ├── jam-signaling.ts          # WebSocket signaling client
│   └── jam-types.ts              # Type definitions (JamPeer, JamChatMessage, callbacks)
├── stores/
│   └── jam-store.ts              # Reactive state: peers, streams, chat messages, video
```

### Modified Files

```
src/
├── components/
│   ├── AppSidebar.tsx            # Add "Jam" tab entry
│   └── index.ts                  # Export new jam components
├── stores/
│   └── index.ts                  # Export jam-store
├── vite.config.ts               # Add jam chunk to manualChunks if needed
```

### New Dependencies

```json
{
  "simple-peer": "^9.11.1",       // Lightweight WebRTC wrapper (~8 kB)
  // OR implement directly with RTCPeerConnection (no dependency, ~200 LOC)
}
```

### Jam Store State Shape

```typescript
interface JamState {
  roomId: string | null
  isHost: boolean
  peers: Map<string, JamPeer>
  localStream: MediaStream | null
  isMuted: boolean
  latency: Map<string, number>  // peerId → ms
  sharedMelodyId: string | null // optional: share current melody with peers
}

interface JamPeer {
  id: string
  displayName: string
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'failed'
  latency: number
  hasVideo: boolean
  hasAudio: boolean
}

interface JamChatMessage {
  id: string
  peerId: string
  displayName: string
  text: string
  timestamp: number
}
```

## Phased Implementation

### Phase 1: MWE — Two-Peer Audio (Week 1-2)

**Goal**: Two PitchPerfect users can hear each other's microphone audio in real-time.

```
1.1 Signaling server (Cloudflare Worker + Durable Object)
     - Room create/join REST endpoints
     - WebSocket relay for SDP/ICE exchange
     - Max 2 peers initially

1.2 Client WebRTC integration (src/lib/jam-service.ts)
     - Simple RTCPeerConnection setup (or simple-peer)
     - Opus codec preference, echo cancellation disabled
     - Basic connection state handling

1.3 Minimal UI (src/components/JamPanel.tsx)
     - "Create Room" / "Join Room" with room code input
     - Connected/disconnected indicator
     - Mute toggle
     - Integrated as new tab in AppSidebar
```

### Phase 2: Multi-Peer & Polish (Week 3-4)

```
2.1 Multi-peer mesh topology (up to 4-6 peers)
     - Each peer maintains N-1 RTCPeerConnections
     - Participant list with connection quality indicators
     - Graceful peer departure handling

2.2 Room management UX
     - Shareable room links (pitchperfect.clodhost.com/jam/roomId)
     - Room code for easy joining
     - Kick/transfer host controls

2.3 Audio quality
     - Configurable Opus bitrate in jam settings
     - Individual peer volume control
     - Solo/mute per peer
```

### Phase 2.5: Video + Chat (Week 3-4)

**Goal**: Participants can see each other via webcam and exchange text messages.

```
2.5.1 Video stream support
       - Camera capture alongside microphone (640x480, 15fps)
       - Video track added to existing RTCPeerConnection media streams
       - Per-peer video tiles in a responsive grid layout
       - Camera on/off toggle with track replacement (no renegotiation)
       - Local video mirror preview

2.5.2 Text chat via DataChannel
       - Dedicated 'chat' DataChannel per peer connection
       - JSON message protocol: { type: 'chat', id, text, displayName, timestamp }
       - Chat history within session (ephemeral, not persisted)
       - Own-message styling distinction (accent vs green)
       - Auto-scroll to latest message
```

### Phase 3: Musical Context (Week 5-6)

```
3.1 Shared melody viewing
     - Host shares current session/melody via DataChannel
     - Peers see same piano roll / falling notes
     - "Play along" mode synchronized to host playback

3.2 Shared practice tools
     - Host selects a singing melody or piano exercise
     - Pitch canvas: real-time pitch visualization shared across peers
     - Practice mode: sing the melody together, see each other's pitch
     - Piano practice: shared MIDI keyboard view with note highlighting
     - Exercise library: curated vocal warm-ups, interval training, sight-reading

3.3 Persistent room settings
     - Room name, description
     - BPM sync for metronome
     - Skill level and genre tags for discovery
```

### Phase 4: Advanced (Future)

```
4.1 SFU fallback for large groups (>6 peers)
     - Selective Forwarding Unit on Cloudflare (Media Channel API or external)
     - Reduces uplink bandwidth from N to 1 stream

4.2 Jam recording
     - Record mixed output (local + all peers)
     - Save as WAV/MP3, optionally generate MIDI

4.3 Presence and discovery
     - Public room listing
     - "Looking to jam" status
     - Genre/skill level filters
```

## Effort Estimate

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 (MWE) | Signaling server + 2-peer audio + minimal UI | 5-8 days |
| Phase 2 (Multi-peer) | Mesh topology, room management, quality | 5-7 days |
| Phase 3 (Context) | Shared melody, chat, sync | 4-6 days |
| Phase 4 (Advanced) | SFU, recording, discovery | TBD |
| **Total (Phases 1-3)** | | **14-21 days** |

## Cloudflare Cost Estimate

For initial usage (~100 concurrent jam rooms, signaling only):

| Resource | Estimate |
|----------|----------|
| Worker requests (room CRUD) | ~10K/day → Free tier (100K/day) |
| Durable Object (signaling WebSocket) | ~$0.15/M requests + $0.00015/GB-sec |
| Estimated monthly for 100 active users | **<$5/month** |

No server audio processing costs — all audio is P2P.

## Design Decisions (resolved)

1. **Mesh topology** — Start with mesh for simplicity; evaluate SFU later if real usage shows pain. Mesh handles 2-4 peers fine.
2. **Separate audio engine** — Jam audio outputs directly to speakers, bypassing pitch detection. Integrate later when the feature proves itself.
3. **Anonymous auth** — Join with room code + display name, no account/profile required. Lowest friction for early testing.
4. **Skip TURN** — No TURN relay for MWE. Accept that ~8% of symmetric NAT users won't connect; revisit when real users hit the wall.
5. **Mobile support** — WebRTC works on mobile browsers but iOS Safari has limitations — test early.

## Success Criteria (MWE)

✅ Two users can connect to a jam room via room code
✅ Both users hear each other's microphone audio with <100ms latency
✅ Audio quality is music-appropriate (echo cancellation disabled, Opus at 128+ kbps)
✅ Each user can mute their own microphone
✅ Signaling server runs on Cloudflare Workers (no additional VPS)
✅ Integration feels native within PitchPerfect UI (sidebar tab)
✅ Hash routing: `#jam:ROOMID` links auto-join rooms (welcome screen dismissed)

### Video + Chat (Phase 2.5)

✅ Camera capture and P2P video streaming (640x480, 15fps)
✅ Video toggle on/off without renegotiation (track replacement)
✅ Responsive video grid with local mirror + remote tiles
✅ Text chat via WebRTC DataChannel (per-peer, JSON protocol)
✅ Chat message display with own/other styling and timestamps

## Implementation Status (2026-05-16)

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Signaling server (Worker + DO) | ✅ Complete |
| 1 | WebRTC audio (Opus, echo off) | ✅ Complete |
| 1 | Room create/join UI | ✅ Complete |
| 1 | Invite modal with links | ✅ Complete |
| 1 | Hash routing for jam links | ✅ Complete |
| 2 | Multi-peer mesh topology | ✅ Complete |
| 2.5 | Video streaming | ✅ Complete |
| 2.5 | Text chat via DataChannel | ✅ Complete |
| 3.1 | Shared melody viewing | Planned |
| 3.2 | Shared practice (pitch canvas) | Planned |
| 3.3 | Room settings (name, BPM) | Planned |
| 4 | SFU, recording, discovery | Future |
