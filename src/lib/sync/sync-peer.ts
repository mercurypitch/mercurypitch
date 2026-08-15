// ── Sync peer ────────────────────────────────────────────────────────
// A WebRTC connection that carries only data, for moving songs between
// two of one person's devices.
//
// This is the jam room's connection choreography — same signaling worker,
// same glare rule, same ICE buffering — with everything about media cut
// out. No getUserMedia, no tracks, no renegotiation-for-video: the mic is
// never touched, so none of the MicManager rules apply here. The room a
// sync session uses is an ordinary jam-worker room; the worker relays SDP
// either way and never sees what the DataChannel carries.
//
// Deliberately its own small module rather than a mode of jam/service.ts:
// that service owns microphone capture, transmit-clone processing and ICE
// restart for hour-long rooms, none of which a two-minute transfer wants
// to inherit. When the jam room's planned transfer refactor lands, it can
// adopt this shape; until then the shared pieces (signaling client, ICE
// servers, chunking, hashing, relay detection) are imported, not copied.
//
// See docs/plans/device-sync.md (Phase 5).

import { FALLBACK_ICE_SERVERS, getIceServers, resetIceServers, } from '@/lib/jam/ice-servers'
import { createSignalingClient } from '@/lib/jam/signaling'
import type { JamPeer } from '@/lib/jam/types'

export interface SyncPeerCallbacks {
  /** The channel to this peer is open — the protocol can start. */
  onChannelReady: (peerId: string, displayName: string) => void
  /**
   * This peer is gone: it left the room, its connection failed, or its
   * channel closed. Called at most once per peer, and the connection is
   * torn down first so a later re-announcement can build a fresh one.
   */
  onPeerLeft: (peerId: string) => void
  /** A parsed JSON control frame from this peer. */
  onControl: (peerId: string, msg: Record<string, unknown>) => void
  /** A slice of part bytes from this peer. */
  onChunk: (peerId: string, bytes: ArrayBuffer) => void
  onError: (message: string) => void
  onRoomClosed: () => void
}

export function createSyncPeer(cb: SyncPeerCallbacks) {
  const peerConnections = new Map<string, RTCPeerConnection>()
  const dataChannels = new Map<string, RTCDataChannel>()
  const pendingCandidates = new Map<string, string[]>()
  const displayNames = new Map<string, string>()
  let iceServers: RTCIceServer[] = FALLBACK_ICE_SERVERS
  let disposed = false

  const signaling = createSignalingClient(
    {
      onPeerJoined: (peer: JamPeer) => {
        if (disposed) return
        displayNames.set(peer.id, peer.displayName)
        // Same glare rule as the jam room: the peer with the greater id
        // initiates, and if ours is not known yet we initiate anyway and
        // let handleOffer's rollback resolve the collision.
        const myId = signaling.getPeerId()
        if (myId === null || myId === '' || myId > peer.id) {
          initiateNewPeer(peer.id).catch((err) =>
            console.warn('[sync:peer] initiate failed', err),
          )
        }
      },
      onPeerLeft: (peerId: string) => {
        losePeer(peerId)
      },
      onOffer: (from, sdp) => {
        handleOffer(from, sdp).catch((err) =>
          console.warn('[sync:peer] handleOffer failed', err),
        )
      },
      onAnswer: (from, sdp) => {
        handleAnswer(from, sdp).catch((err) =>
          console.warn('[sync:peer] handleAnswer failed', err),
        )
      },
      onIceCandidate: (from, candidate) => {
        handleIceCandidate(from, candidate).catch(() => {})
      },
      onRoomClosed: () => cb.onRoomClosed(),
      onError: (message) => cb.onError(message),
      // Required by the shared callbacks type; the signaling client never
      // calls these — they belong to the media half this module cut out.
      onPeerStream: () => {},
      onConnectionStateChange: () => {},
      onLatencyUpdate: () => {},
      onChatMessage: () => {},
    },
    // A sync room must not appear in the jam lobby as a room to rejoin.
    { rememberRooms: false },
  )

  // The disposed check has to happen on BOTH sides of the await. getIceServers
  // is a network call with a 4s timeout path, and closing the sync modal during
  // it runs dispose() — which disconnects the signaling client that has not
  // connected yet. Without the second check the continuation then opens a
  // WebSocket and a room, after the only thing that could close them is gone.

  async function createRoom(displayName: string): Promise<void> {
    if (disposed) return
    iceServers = await getIceServers()
    if (disposed) return
    signaling.createRoom(displayName)
  }

  async function joinRoom(roomId: string, displayName: string): Promise<void> {
    if (disposed) return
    iceServers = await getIceServers()
    if (disposed) return
    signaling.connect(roomId, displayName)
  }

  function leaveRoom(): void {
    resetIceServers()
    iceServers = FALLBACK_ICE_SERVERS
    for (const id of [...peerConnections.keys()]) dropPeer(id)
    signaling.leaveRoom()
  }

  function dropPeer(peerId: string): void {
    dataChannels.get(peerId)?.close()
    dataChannels.delete(peerId)
    peerConnections.get(peerId)?.close()
    peerConnections.delete(peerId)
    pendingCandidates.delete(peerId)
    displayNames.delete(peerId)
  }

  /**
   * Tear a peer down and say so, exactly once.
   *
   * Every way a pair can die -- leaving the room, ICE failing, the
   * channel closing -- comes through here, because the alternative is a
   * connection that is dead while the map still holds it: the UI keeps
   * claiming "connected", `initiateNewPeer` refuses to rebuild
   * (`peerConnections.has`), and the session cannot recover without a
   * page reload. Removing it first is what lets a re-announced peer
   * build a fresh connection.
   */
  function losePeer(peerId: string, retry = false): void {
    if (!peerConnections.has(peerId) && !dataChannels.has(peerId)) return
    const displayName = displayNames.get(peerId) ?? 'Another device'
    dropPeer(peerId)
    cb.onPeerLeft(peerId)
    // A pair that died while both devices stayed in the room (a Wi-Fi
    // wobble, a phone carried through a doorway) can simply be rebuilt —
    // the pairing is warm state now (REQ-SYNC-030), and nobody should
    // retype a code over a two-second blip. Signaling-level departures
    // do not retry: an offer to a peer that left the room lands nowhere.
    if (retry) scheduleReconnect(peerId, displayName)
  }

  /**
   * Try to rebuild a dropped pair while both sides are still in the
   * room — twice, then let the store's arrival deadline speak. The same
   * glare rule as a fresh join picks one initiator; the polite side only
   * restores the display name and waits for the offer. This is not ICE
   * restart: it is a brand-new connection, which is exactly what
   * losePeer removing the corpse makes possible. A transfer that was in
   * flight has already failed honestly (REQ-SYNC-035 restores the
   * PAIRING, never the song).
   */
  function scheduleReconnect(peerId: string, displayName: string): void {
    for (const delay of [2_000, 8_000]) {
      setTimeout(() => {
        if (disposed || peerConnections.has(peerId)) return
        displayNames.set(peerId, displayName)
        const myId = signaling.getPeerId()
        if (myId === null || myId === '' || myId > peerId) {
          initiateNewPeer(peerId).catch(() => {})
        }
      }, delay)
    }
  }

  async function initiateNewPeer(peerId: string): Promise<void> {
    if (disposed || peerConnections.has(peerId)) return
    const pc = new RTCPeerConnection({ iceServers })
    setupPeerHandlers(pc, peerId)
    // Created before the offer, so the channel rides the first and only
    // negotiation — a data-only connection never has a second one.
    const dc = pc.createDataChannel('sync')
    setupDataChannel(dc, peerId)
    peerConnections.set(peerId, pc)
  }

  async function handleOffer(from: string, sdp: string): Promise<void> {
    if (disposed) return
    let pc = peerConnections.get(from)
    if (!pc) {
      pc = new RTCPeerConnection({ iceServers })
      setupPeerHandlers(pc, from)
      peerConnections.set(from, pc)
    } else if (pc.signalingState === 'have-local-offer') {
      // Glare: the polite peer (smaller id) rolls back, the impolite one
      // ignores the incoming offer. Same split the jam room uses.
      const myId = signaling.getPeerId()
      if (myId !== null && myId !== '' && myId < from) {
        await pc.setLocalDescription({ type: 'rollback' })
      } else {
        return
      }
    }
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)))
    await drainCandidates(pc, from)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    signaling.sendAnswer(from, JSON.stringify(answer))
  }

  async function handleAnswer(from: string, sdp: string): Promise<void> {
    const pc = peerConnections.get(from)
    if (!pc || disposed) return
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)))
    await drainCandidates(pc, from)
  }

  async function drainCandidates(
    pc: RTCPeerConnection,
    from: string,
  ): Promise<void> {
    const pending = pendingCandidates.get(from)
    if (pending === undefined) return
    pendingCandidates.delete(from)
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)))
      } catch {
        // A malformed candidate is not worth a broken join.
      }
    }
  }

  async function handleIceCandidate(
    from: string,
    candidate: string,
  ): Promise<void> {
    const pc = peerConnections.get(from)
    // Candidates can outrun the offer; buffer until the description lands.
    if (!pc || !pc.remoteDescription || disposed) {
      if (!disposed) {
        const pending = pendingCandidates.get(from) ?? []
        pending.push(candidate)
        pendingCandidates.set(from, pending)
      }
      return
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)))
    } catch {
      // Ignore — a lost candidate just narrows the paths ICE can try.
    }
  }

  function setupPeerHandlers(pc: RTCPeerConnection, peerId: string): void {
    pc.ondatachannel = (event) => {
      if (event.channel.label === 'sync') {
        setupDataChannel(event.channel, peerId)
      }
    }
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.sendIceCandidate(
          peerId,
          JSON.stringify(event.candidate.toJSON()),
        )
      }
    }
    pc.onnegotiationneeded = async () => {
      try {
        if (pc.signalingState !== 'stable') return
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        signaling.sendOffer(peerId, JSON.stringify(offer))
      } catch (err) {
        console.warn('[sync:peer] negotiation failed for', peerId, err)
      }
    }
    // No ICE-restart machinery on purpose: a sync session lives minutes,
    // not hours, and the honest answer to a dropped pair mid-transfer is
    // to say so and let the person try again -- not a renegotiation
    // dance. What matters is that the dead pair is REMOVED, so the next
    // attempt builds a new one instead of reusing a corpse — and
    // scheduleReconnect IS that next attempt, made without anyone
    // retyping a code.
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        cb.onError('The connection between the devices was lost.')
        losePeer(peerId, true)
      }
    }
  }

  function setupDataChannel(dc: RTCDataChannel, peerId: string): void {
    dataChannels.set(peerId, dc)
    // Part bytes arrive as raw binary; without this they would surface as
    // a Blob in some browsers and an ArrayBuffer in others.
    dc.binaryType = 'arraybuffer'
    dc.onopen = () => {
      cb.onChannelReady(peerId, displayNames.get(peerId) ?? 'Another device')
    }
    // A closed channel is the death every transfer actually notices: the
    // signaling socket can stay up (so no peer-left arrives) while the
    // pair is gone, and without this the store keeps a channel it can
    // write to and never hears back from.
    dc.onclose = () => {
      losePeer(peerId, true)
    }
    dc.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        cb.onChunk(peerId, event.data)
        return
      }
      if (typeof event.data !== 'string') return
      try {
        const msg: unknown = JSON.parse(event.data)
        if (typeof msg === 'object' && msg !== null) {
          cb.onControl(peerId, msg as Record<string, unknown>)
        }
      } catch {
        // A frame that does not parse is a peer speaking a protocol this
        // build does not know. Ignoring it beats crashing the transfer.
      }
    }
  }

  function sendControl(peerId: string, msg: object): boolean {
    const dc = dataChannels.get(peerId)
    if (dc?.readyState !== 'open') return false
    dc.send(JSON.stringify(msg))
    return true
  }

  /** The raw channel, for a transfer to drive with backpressure. */
  function channelTo(peerId: string): RTCDataChannel | null {
    return dataChannels.get(peerId) ?? null
  }

  /** The connection, so a transfer can ask whether its route is relayed. */
  function connectionTo(peerId: string): RTCPeerConnection | null {
    return peerConnections.get(peerId) ?? null
  }

  function dispose(): void {
    disposed = true
    for (const id of [...peerConnections.keys()]) dropPeer(id)
    resetIceServers()
    signaling.disconnect()
  }

  return {
    createRoom,
    joinRoom,
    leaveRoom,
    dispose,
    sendControl,
    channelTo,
    connectionTo,
    getRoomId: () => signaling.getRoomId(),
    getPeerId: () => signaling.getPeerId(),
  }
}

export type SyncPeer = ReturnType<typeof createSyncPeer>
