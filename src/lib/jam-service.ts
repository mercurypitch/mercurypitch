// ── Jam service ─────────────────────────────────────────────────────
// Manages WebRTC peer connections for P2P audio streaming.
// Handles RTCPeerConnection lifecycle, Opus codec configuration,
// and audio track management.

import type { JamCallbacks, JamPeer } from './jam-types'
import { createSignalingClient } from './jam-signaling'

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

// Audio constraints optimized for music — disable all processing
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 },
}

export function createJamService(callbacks: JamCallbacks) {
  let localStream: MediaStream | null = null
  const peerConnections = new Map<string, RTCPeerConnection>()
  let disposed = false

  const signaling = createSignalingClient({
    ...callbacks,
    // Wrap onPeerJoined: initiate WebRTC handshake, then notify store
    onPeerJoined: async (peer: JamPeer) => {
      await initiatePeerConnection(peer)
      callbacks.onPeerJoined(peer)
    },
    // Wrap onPeerLeft: close PC, then notify store
    onPeerLeft: (peerId: string) => {
      const pc = peerConnections.get(peerId)
      if (pc) {
        pc.close()
        peerConnections.delete(peerId)
      }
      callbacks.onPeerLeft(peerId)
    },
    onOffer: async (target, sdp) => {
      await handleOffer(target, sdp)
    },
    onAnswer: async (target, sdp) => {
      await handleAnswer(target, sdp)
    },
    onIceCandidate: async (target, candidate) => {
      await handleIceCandidate(target, candidate)
    },
  })

  // ── Room lifecycle ──────────────────────────────────────────────

  async function createRoom(displayName: string): Promise<void> {
    if (disposed) return
    await startLocalStream()
    signaling.createRoom(displayName)
  }

  async function joinRoom(roomId: string, displayName: string): Promise<void> {
    if (disposed) return
    await startLocalStream()
    signaling.connect(roomId, displayName)
  }

  function leaveRoom(): void {
    for (const [id, pc] of peerConnections) {
      pc.close()
      peerConnections.delete(id)
    }
    signaling.leaveRoom()
  }

  // ── Local audio ─────────────────────────────────────────────────

  async function startLocalStream(): Promise<void> {
    if (localStream) return
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
        video: false,
      })
    } catch (err) {
      callbacks.onError('Microphone access denied or unavailable')
      throw err
    }
  }

  function stopLocalStream(): void {
    localStream?.getTracks().forEach((t) => t.stop())
    localStream = null
  }

  function setMuted(muted: boolean): void {
    if (!localStream) return
    localStream.getAudioTracks().forEach((t) => {
      t.enabled = !muted
    })
  }

  // ── Peer connection management ──────────────────────────────────

  async function initiatePeerConnection(peer: JamPeer): Promise<void> {
    if (disposed || peerConnections.has(peer.id)) return

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    // Add local audio track
    if (localStream) {
      localStream.getTracks().forEach((t) => {
        pc.addTrack(t, localStream!)
      })
    }

    // Handle remote audio track
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0]
      if (remoteStream) {
        callbacks.onPeerStream(peer.id, remoteStream)
      }
    }

    pc.onconnectionstatechange = () => {
      const state = mapConnectionState(pc.connectionState)
      callbacks.onConnectionStateChange(peer.id, state)
    }

    pc.oniceconnectionstatechange = () => {
      // Measure RTT via stats when ICE connects
      if (pc.iceConnectionState === 'connected') {
        measureLatency(peer.id, pc)
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.sendIceCandidate(peer.id, JSON.stringify(event.candidate.toJSON()))
      }
    }

    peerConnections.set(peer.id, pc)

    // Create and send offer
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    signaling.sendOffer(peer.id, JSON.stringify(offer))
  }

  async function handleOffer(target: string, sdp: string): Promise<void> {
    if (disposed) return

    let pc = peerConnections.get(target)
    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      if (localStream) {
        localStream.getTracks().forEach((t) => {
          pc!.addTrack(t, localStream!)
        })
      }
      setupPeerHandlers(pc, target)
      peerConnections.set(target, pc)
    }

    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    signaling.sendAnswer(target, JSON.stringify(answer))
  }

  async function handleAnswer(target: string, sdp: string): Promise<void> {
    const pc = peerConnections.get(target)
    if (!pc || disposed) return
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)))
  }

  async function handleIceCandidate(target: string, candidate: string): Promise<void> {
    const pc = peerConnections.get(target)
    if (!pc || disposed) return
    try {
      await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)))
    } catch {
      // Ignore malformed candidates
    }
  }

  function setupPeerHandlers(pc: RTCPeerConnection, peerId: string): void {
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0]
      if (remoteStream) {
        callbacks.onPeerStream(peerId, remoteStream)
      }
    }
    pc.onconnectionstatechange = () => {
      callbacks.onConnectionStateChange(peerId, mapConnectionState(pc.connectionState))
    }
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected') {
        measureLatency(peerId, pc)
      }
    }
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.sendIceCandidate(peerId, JSON.stringify(event.candidate.toJSON()))
      }
    }
  }

  // ── Latency measurement ─────────────────────────────────────────

  async function measureLatency(peerId: string, pc: RTCPeerConnection): Promise<void> {
    try {
      const stats = await pc.getStats()
      let rtt = 0
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && 'currentRoundTripTime' in report) {
          rtt = (report.currentRoundTripTime as number) * 1000
        }
      })
      if (rtt > 0) {
        callbacks.onLatencyUpdate(peerId, Math.round(rtt))
      }
    } catch {
      // Stats not available
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────

  function dispose(): void {
    disposed = true
    for (const [, pc] of peerConnections) {
      pc.close()
    }
    peerConnections.clear()
    stopLocalStream()
    signaling.disconnect()
  }

  function getLocalStream(): MediaStream | null {
    return localStream
  }

  function getRoomId(): string | null {
    return signaling.getRoomId()
  }

  function getPeerId(): string | null {
    return signaling.getPeerId()
  }

  return {
    createRoom,
    joinRoom,
    leaveRoom,
    setMuted,
    getLocalStream,
    getRoomId,
    getPeerId,
    dispose,
  }
}

function mapConnectionState(state: RTCPeerConnectionState): JamPeer['connectionState'] {
  switch (state) {
    case 'new':
    case 'connecting':
      return 'connecting'
    case 'connected':
      return 'connected'
    case 'disconnected':
      return 'disconnected'
    case 'failed':
    case 'closed':
      return 'failed'
    default:
      return 'disconnected'
  }
}
