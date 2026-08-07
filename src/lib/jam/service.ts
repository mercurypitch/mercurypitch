// ── Jam service ─────────────────────────────────────────────────────
// Manages WebRTC peer connections for P2P audio + video streaming.
// Handles RTCPeerConnection lifecycle, Opus codec configuration,
// camera/mic capture, and track management.

import type { MelodyData } from '@/types'
import { decideIceRestart, DISCONNECTED_GRACE_MS } from './ice-recovery'
import { FALLBACK_ICE_SERVERS, getIceServers, resetIceServers, } from './ice-servers'
import { micErrorMessage, micPermissionState } from './media-errors'
import { createSignalingClient, jamSignalingIsMocked } from './signaling'
import type { JamBackgroundCapabilityMessage, JamCallbacks, JamPeer, } from './types'

// Audio constraints optimized for music — disable all processing
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 },
}

/**
 * What the peers get: the same microphone, processed for human ears.
 *
 * The capture above is right for a pitch detector and wrong for a voice
 * room -- with cancellation off, one device's speaker feeds the other's
 * microphone and the room howls. So the transmitted track is a CLONE with
 * the processing turned back on, and the raw capture stays exactly as it
 * was for analysis.
 *
 * A clone rather than a second getUserMedia deliberately: iOS Safari has
 * historically answered a second capture by stopping the first, which
 * would take the microphone out from under the whole room.
 *
 * See docs/plans/jam-mic-feedback.md.
 */
const TRANSMIT_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 15 },
}

export function createJamService(callbacks: JamCallbacks) {
  // A preview room has no remote endpoint. Keep the local media surface alive
  // (so a capture can exercise the mic UI), but never fetch ICE credentials or
  // construct a peer connection for the invented peers.
  const previewMode = jamSignalingIsMocked()
  let localStream: MediaStream | null = null
  /** The processed clone the peers actually hear -- see makeTransmitTrack. */
  let transmitAudio: MediaStreamTrack | null = null
  let localVideo: MediaStreamTrack | null = null
  const peerConnections = new Map<string, RTCPeerConnection>()
  const dataChannels = new Map<string, RTCDataChannel>()
  const pendingCandidates = new Map<string, string[]>()
  /** ICE restart attempts per peer, reset once the pair connects. */
  const iceRetries = new Map<string, number>()
  const iceRecoveryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  /**
   * Fetched once when the room is entered. Starts as the STUN-only fallback
   * so a peer connection built before the fetch lands still has somewhere to
   * look, rather than being constructed with nothing.
   */
  let iceServers: RTCIceServer[] = FALLBACK_ICE_SERVERS
  let disposed = false
  let videoEnabled = false
  let localDisplayName = ''

  const signaling = createSignalingClient({
    ...callbacks,
    onPeerJoined: (peer: JamPeer) => {
      callbacks.onPeerJoined(peer)
      if (previewMode) return
      // Only initiate connection if our ID > peer ID to prevent glare.
      // If our ID is not yet known, always initiate — handleOffer will resolve glare.
      const myId = signaling.getPeerId()
      console.info(
        '[jam:service] onPeerJoined',
        peer.id,
        'myId=',
        myId,
        'will initiate=',
        myId === null || myId === '' || myId > peer.id,
      )
      if (myId === null || myId === '' || myId > peer.id) {
        console.info('[jam:service] initiating connection to', peer.id)
        initiateNewPeer(peer).catch((err) =>
          console.error('[jam:service] initiateNewPeer failed', err),
        )
      } else {
        console.info(
          '[jam:service] waiting for peer',
          peer.id,
          'to initiate (their ID is greater)',
        )
      }
    },
    onPeerLeft: (peerId: string) => {
      const pc = peerConnections.get(peerId)
      if (pc) {
        pc.close()
        peerConnections.delete(peerId)
      }
      const dc = dataChannels.get(peerId)
      if (dc) {
        dc.close()
        dataChannels.delete(peerId)
      }
      pendingCandidates.delete(peerId)
      callbacks.onPeerLeft(peerId)
    },
    onOffer: (from, sdp) => {
      handleOffer(from, sdp).catch((err) =>
        console.warn('[Jam] handleOffer failed:', err),
      )
    },
    onAnswer: (from, sdp) => {
      handleAnswer(from, sdp).catch((err) =>
        console.warn('[Jam] handleAnswer failed:', err),
      )
    },
    onIceCandidate: (from, candidate) => {
      handleIceCandidate(from, candidate).catch((err) =>
        console.info('[Jam] ICE candidate failed:', err),
      )
    },
  })

  // ── Room lifecycle ──────────────────────────────────────────────

  async function createRoom(displayName: string): Promise<void> {
    if (disposed) return
    localDisplayName = displayName
    openLocalStream()
    if (!previewMode) iceServers = await getIceServers()
    signaling.createRoom(displayName)
  }

  async function joinRoom(roomId: string, displayName: string): Promise<void> {
    if (disposed) return
    localDisplayName = displayName
    openLocalStream()
    if (!previewMode) iceServers = await getIceServers()
    signaling.connect(roomId, displayName)
  }

  function leaveRoom(): void {
    // Credentials are short-lived; the next room mints its own.
    resetIceServers()
    iceServers = FALLBACK_ICE_SERVERS
    for (const [, dc] of dataChannels) {
      dc.close()
    }
    dataChannels.clear()
    for (const [id, pc] of peerConnections) {
      pc.close()
      peerConnections.delete(id)
    }
    signaling.leaveRoom()
  }

  // ── Local audio ─────────────────────────────────────────────────

  /**
   * Make the processed track the peers hear, or decide not to.
   *
   * Two ways this can fail, and both end with sending the raw capture --
   * which is exactly today's behaviour, so a refusal costs nothing:
   *
   * - the device will not enable cancellation on a clone at all;
   * - the device applies the constraint to the shared SOURCE instead of
   *   the clone, which would quietly hand the pitch detector cancelled,
   *   noise-suppressed, gain-ridden audio. That one is checked for
   *   explicitly, and undone, because a detector fed processed audio is
   *   wrong in ways nobody would think to look for.
   */
  async function makeTransmitTrack(
    raw: MediaStreamTrack,
  ): Promise<MediaStreamTrack | null> {
    let clone: MediaStreamTrack | null = null
    try {
      clone = raw.clone()
      await clone.applyConstraints(TRANSMIT_CONSTRAINTS)
      if (clone.getSettings().echoCancellation !== true) {
        console.info(
          '[jam:mic] this device would not cancel echo on a clone — sending the raw capture',
        )
        clone.stop()
        return null
      }
      if (raw.getSettings().echoCancellation === true) {
        console.info(
          '[jam:mic] constraining the clone reconfigured the shared source — backing out to keep pitch analysis honest',
        )
        clone.stop()
        await raw.applyConstraints(AUDIO_CONSTRAINTS)
        return null
      }
      console.info('[jam:mic] transmitting with echo cancellation on')
      return clone
    } catch (err) {
      console.info('[jam:mic] could not build a processed track', err)
      clone?.stop()
      return null
    }
  }

  /**
   * Give a peer connection this device's tracks.
   *
   * One place, because the audio a peer hears is NOT the audio this
   * device analyses: the processed clone goes out, the raw capture stays
   * here. Two copies of this loop is how they would drift apart.
   */
  function addLocalTracks(pc: RTCPeerConnection): void {
    const stream = localStream
    if (stream === null) return
    for (const track of stream.getTracks()) {
      pc.addTrack(
        track.kind === 'audio' && transmitAudio !== null
          ? transmitAudio
          : track,
        stream,
      )
    }
  }

  /**
   * The container the local tracks go into, with nothing in it.
   *
   * Entering a room used to call getUserMedia, so the permission prompt was
   * the first thing a room said to you -- before you knew who was there or
   * whether you wanted to sing. Worse, the answer was "yes and live": mute
   * defaulted off, so a tablet on a desk started transmitting the room it
   * was sitting in.
   *
   * So the room opens silent and asks for nothing. The mic is captured by
   * `startLocalAudio` when somebody unmutes, which is a moment they chose
   * and can attach a meaning to. An empty MediaStream keeps every consumer
   * -- the local video chip, the pitch detector, addLocalTracks -- working
   * against one object whether or not it has tracks yet.
   */
  function openLocalStream(): void {
    localStream ??= new MediaStream()
  }

  /**
   * Capture the microphone and give it to everyone already connected.
   *
   * Adding a track to a live RTCPeerConnection fires negotiationneeded, and
   * the handler set up in setupPeerHandlers turns that into an offer -- the
   * same path enabling the camera mid-call has always used. Returns whether
   * there is now a microphone.
   */
  async function startLocalAudio(): Promise<boolean> {
    openLocalStream()
    if (localStream!.getAudioTracks().length > 0) return true
    let captured: MediaStream
    try {
      captured = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
        video: false,
      })
    } catch (err) {
      // Ask the browser what it already decided, so a site-level Block --
      // which never shows a prompt -- is named as such instead of looking
      // like a permission the user simply has not granted yet.
      const blocked = (await micPermissionState()) === 'denied'
      callbacks.onError(micErrorMessage(err, blocked))
      return false
    }
    const rawAudio = captured.getAudioTracks()[0]
    if (rawAudio === undefined) return false
    localStream!.addTrack(rawAudio)
    transmitAudio = await makeTransmitTrack(rawAudio)
    const outgoing = transmitAudio ?? rawAudio
    for (const [, pc] of peerConnections) {
      // Only if this connection has no audio yet. A second sender would
      // have the room hearing two copies of one voice.
      const existing = pc.getSenders().find((s) => s.track?.kind === 'audio')
      if (existing === undefined) pc.addTrack(outgoing, localStream!)
      else void existing.replaceTrack(outgoing)
    }
    return true
  }

  /** Whether the microphone has actually been captured yet. */
  function hasLocalAudio(): boolean {
    return (localStream?.getAudioTracks().length ?? 0) > 0
  }

  async function startLocalVideo(): Promise<void> {
    if (localVideo) return
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: VIDEO_CONSTRAINTS,
      })
      const vt = videoStream.getVideoTracks()[0]
      if (vt !== undefined) {
        localVideo = vt
        localStream?.addTrack(vt)
        for (const [, pc] of peerConnections) {
          pc.addTrack(vt, localStream!)
        }
        videoEnabled = true
        broadcastVideoState(true)
      }
    } catch {
      callbacks.onError('Camera access denied or unavailable')
    }
  }

  function stopLocalVideo(): void {
    if (localVideo) {
      localVideo.stop()
      if (localStream) localStream.removeTrack(localVideo)
      localVideo = null
      videoEnabled = false
      broadcastVideoState(false)
    }
  }

  async function setVideoEnabled(enabled: boolean): Promise<void> {
    if (enabled && !localVideo) {
      await startLocalVideo()
      return
    }
    if (!localVideo) return
    videoEnabled = enabled
    localVideo.enabled = enabled
    for (const [, pc] of peerConnections) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) {
        await sender.replaceTrack(enabled ? localVideo : null)
      }
    }
    broadcastVideoState(enabled)
  }

  function stopLocalStream(): void {
    localStream?.getTracks().forEach((t) => t.stop())
    transmitAudio?.stop()
    transmitAudio = null
    localStream = null
    localVideo = null
    videoEnabled = false
    broadcastVideoState(false)
  }

  function setMuted(muted: boolean): void {
    if (!localStream) return
    // Both the raw capture and the processed clone. Muting one would
    // either leave you audible to the room or leave your own pitch trail
    // drawing while nobody can hear you -- and mute means neither.
    if (transmitAudio !== null) transmitAudio.enabled = !muted
    localStream.getAudioTracks().forEach((t) => {
      t.enabled = !muted
    })
  }

  // ── Peer connection management ──────────────────────────────────

  async function initiateNewPeer(peer: JamPeer): Promise<void> {
    if (disposed || peerConnections.has(peer.id)) return

    console.info('[jam:service] initiating connection to', peer.id)
    const pc = new RTCPeerConnection({ iceServers: iceServers })

    addLocalTracks(pc)

    setupPeerHandlers(pc, peer.id)

    // Create DataChannel for chat
    const dc = pc.createDataChannel('chat')
    setupDataChannel(dc, peer.id)

    peerConnections.set(peer.id, pc)
  }

  async function handleOffer(from: string, sdp: string): Promise<void> {
    if (disposed) return

    let pc = peerConnections.get(from)
    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: iceServers })
      addLocalTracks(pc)
      setupPeerHandlers(pc, from)
      peerConnections.set(from, pc)
    } else if (pc.signalingState === 'have-local-offer') {
      // Glare detection — both peers sent offers at the same time.
      // The "polite" peer (lexicographically smaller ID) rolls back and
      // accepts the incoming offer. The "impolite" peer ignores it.
      const myId = signaling.getPeerId()
      if (myId !== null && myId !== '' && myId < from) {
        // We are polite — roll back our local offer and handle the remote
        console.info(
          '[jam] glare: rolling back local offer for polite peer',
          myId,
          '<',
          from,
        )
        await pc.setLocalDescription({ type: 'rollback' })
      } else {
        // We are impolite — ignore the incoming offer (ours wins)
        console.info(
          '[jam] glare: ignoring incoming offer from polite peer',
          from,
        )
        return
      }
    }

    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)))

    // Process any buffered ICE candidates
    const pending = pendingCandidates.get(from)
    if (pending) {
      for (const candidate of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)))
        } catch (_e) {
          // Ignore candidate errors
        }
      }
      pendingCandidates.delete(from)
    }

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    signaling.sendAnswer(from, JSON.stringify(answer))
  }

  async function handleAnswer(from: string, sdp: string): Promise<void> {
    const pc = peerConnections.get(from)
    if (!pc || disposed) return
    console.info('[jam:service] received answer from', from)
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)))

    // Process any buffered ICE candidates
    const pending = pendingCandidates.get(from)
    if (pending) {
      for (const candidate of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)))
        } catch (err) {
          console.warn(
            '[jam:service] failed to add buffered ICE candidate',
            err,
          )
        }
      }
      pendingCandidates.delete(from)
    }
  }

  async function handleIceCandidate(
    from: string,
    candidate: string,
  ): Promise<void> {
    const pc = peerConnections.get(from)

    // Buffer candidate if pc doesn't exist OR remote description is not set yet
    if (!pc || !pc.remoteDescription || disposed) {
      if (!disposed) {
        const pending = pendingCandidates.get(from) || []
        pending.push(candidate)
        pendingCandidates.set(from, pending)
        console.info(`[jam:service] buffered ICE candidate from ${from}`)
      }
      return
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)))
    } catch (err) {
      console.warn('[jam:service] failed to add ICE candidate', err)
    }
  }

  /**
   * Wrap an event callback so a bug inside it cannot kill the session.
   *
   * These fire outside Solid's render, so the tab's ErrorBoundary never
   * sees them: an exception here escapes to window.onerror and takes the
   * app down. A jam that loses one handler is recoverable; a jam that
   * takes the app with it is not.
   */
  function guarded<A extends unknown[]>(
    label: string,
    fn: (...args: A) => void,
  ): (...args: A) => void {
    return (...args: A) => {
      try {
        fn(...args)
      } catch (err) {
        console.error(`[jam:service] ${label} threw`, err)
      }
    }
  }

  function setupPeerHandlers(pc: RTCPeerConnection, peerId: string): void {
    pc.ontrack = (event) => {
      console.info(
        '[jam:service] ontrack from',
        peerId,
        'streams:',
        event.streams.length,
      )
      const remoteStream = event.streams[0]
      if (remoteStream !== undefined) {
        callbacks.onPeerStream(peerId, remoteStream)
      }
    }
    pc.ondatachannel = (event) => {
      console.info('[jam:service] received DataChannel from', peerId)
      const dc = event.channel
      if (dc.label === 'chat') {
        setupDataChannel(dc, peerId)
      }
    }
    pc.onconnectionstatechange = guarded('onconnectionstatechange', () => {
      console.info('[jam:service] connection state', peerId, pc.connectionState)
      callbacks.onConnectionStateChange(
        peerId,
        mapConnectionState(pc.connectionState),
      )
    })
    pc.oniceconnectionstatechange = guarded(
      'oniceconnectionstatechange',
      () => {
        console.info('[jam:service] ICE state', peerId, pc.iceConnectionState)
        if (pc.iceConnectionState === 'connected') {
          iceRetries.delete(peerId)
          clearIceRecovery(peerId)
          measureLatency(peerId, pc)
          return
        }
        // A connection that fails stays failed. Switching WiFi to cellular,
        // a NAT rebinding, a laptop waking up -- any of these drop the pair
        // permanently unless ICE is restarted, which is why a jam could go
        // quiet with both sides still believing they were in the room.
        if (pc.iceConnectionState === 'failed') {
          recoverIce(pc, peerId, 'failed')
          return
        }
        // 'disconnected' often heals by itself within a few seconds. Give it
        // that chance before spending a renegotiation on it, but do not wait
        // for 'failed', which some browsers take 30s or more to declare.
        if (pc.iceConnectionState === 'disconnected') {
          clearIceRecovery(peerId)
          iceRecoveryTimers.set(
            peerId,
            setTimeout(() => {
              iceRecoveryTimers.delete(peerId)
              if (pc.iceConnectionState === 'disconnected') {
                recoverIce(pc, peerId, 'disconnected')
              }
            }, DISCONNECTED_GRACE_MS),
          )
        }
      },
    )
    pc.onicecandidate = guarded(
      'onicecandidate',
      (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          signaling.sendIceCandidate(
            peerId,
            JSON.stringify(event.candidate.toJSON()),
          )
        }
      },
    )

    // Handle renegotiation for dynamic tracks (e.g. enabling video)
    pc.onnegotiationneeded = async () => {
      try {
        if (pc.signalingState !== 'stable') return
        console.info('[jam:service] negotiation needed for', peerId)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        signaling.sendOffer(peerId, JSON.stringify(offer))
      } catch (err) {
        console.error('[jam:service] negotiation error for', peerId, err)
      }
    }
  }

  // ── DataChannel dispatch ─────────────────────────────────────────

  function setupDataChannel(dc: RTCDataChannel, peerId: string): void {
    dataChannels.set(peerId, dc)
    // Stem audio arrives as raw binary. Without this it would surface as a
    // Blob in some browsers and an ArrayBuffer in others, and the receiver
    // would have to sniff which.
    dc.binaryType = 'arraybuffer'
    dc.onopen = () => {
      console.info('[jam:service] DataChannel open to', peerId)
      dc.send(JSON.stringify({ type: 'video-state', enabled: videoEnabled }))
      callbacks.onPeerChannelReady?.(peerId)
    }
    dc.onclose = () => {
      console.info('[jam:service] DataChannel closed to', peerId)
    }
    dc.onerror = (event) => {
      console.info('[jam:service] DataChannel error to', peerId, event)
    }
    dc.onmessage = (event) => {
      try {
        // Stem audio is the one payload that is not JSON: it is the
        // message type where bytes are the whole problem, so it travels
        // raw rather than paying base64's extra third.
        if (event.data instanceof ArrayBuffer) {
          callbacks.onSongFileChunk?.(event.data, peerId)
          return
        }
        // Anything else non-string is not ours. Peer payloads are
        // untrusted, and being explicit keeps this a routing decision
        // rather than a surprise inside JSON.parse.
        if (typeof event.data !== 'string') return
        const data = JSON.parse(event.data)
        console.info(
          '[jam:service] DataChannel recv',
          data.type,
          'from',
          peerId,
        )
        switch (data.type) {
          case 'chat':
            callbacks.onChatMessage({
              id: data.id,
              peerId,
              displayName: data.displayName,
              text: data.text,
              timestamp: data.timestamp,
            })
            break
          case 'pitch':
            // Stamp the transport peer, exactly as `chat` above does. The
            // payload's own `peerId` is whatever the sender typed: the store
            // keys pitch history by it, and that history is the same array
            // the local microphone writes to, so an attacker-chosen id let
            // one peer file their samples as somebody else's — and that
            // singer's run is then scored and persisted from them. It also
            // let an id nobody owns open an unbounded scoreboard row.
            callbacks.onPitchMessage?.({ ...data, peerId })
            break
          case 'melody':
            callbacks.onMelodyMessage?.(data)
            break
          case 'song':
            callbacks.onSongMessage?.(data)
            break
          case 'song-file':
            callbacks.onSongFileMessage?.(data, peerId)
            break
          case 'song-have':
            callbacks.onSongHaveMessage?.(data, peerId)
            break
          case 'playback':
            callbacks.onPlaybackMessage?.(data, peerId)
            break
          case 'video-state':
            callbacks.onVideoState?.(peerId, data.enabled)
            break
          case 'background-capability':
            if (
              typeof data.backgroundId === 'string' &&
              typeof data.version === 'number' &&
              Number.isSafeInteger(data.version) &&
              data.version > 0 &&
              typeof data.token === 'string' &&
              typeof data.expiresAt === 'string'
            ) {
              callbacks.onBackgroundCapability?.(data, peerId)
            }
            break
        }
      } catch (err) {
        console.warn('[jam:service] DataChannel parse error', err)
      }
    }
  }

  // ── Broadcast helpers ────────────────────────────────────────────

  function broadcastVideoState(enabled: boolean): void {
    broadcastData({ type: 'video-state', enabled })
  }

  function sendBackgroundCapability(
    message: JamBackgroundCapabilityMessage,
    targetPeerId?: string,
  ): void {
    if (targetPeerId === undefined) {
      broadcastData(message)
      return
    }
    const channel = dataChannels.get(targetPeerId)
    if (channel?.readyState === 'open') {
      channel.send(JSON.stringify(message))
    }
  }

  function setRoomBackground(backgroundId: string): void {
    signaling.setBackground(backgroundId)
  }

  function sendChat(text: string): void {
    const msg = {
      type: 'chat' as const,
      id: globalThis.crypto.randomUUID(),
      text,
      displayName: localDisplayName,
      timestamp: Date.now(),
    }
    broadcastData(msg)
  }

  /** `beat` is the sender's room beat, omitted when nothing is playing. */
  function sendPitch(
    pitch: {
      frequency: number
      noteName: string
      cents: number
      clarity: number
      midi: number
    },
    beat?: number,
  ): void {
    const peerId = signaling.getPeerId()
    if (peerId === null || peerId === '') return
    broadcastData({
      type: 'pitch' as const,
      peerId,
      ...pitch,
      timestamp: Date.now(),
      ...(beat === undefined ? {} : { beat }),
    })
  }

  function sendMelody(melody: MelodyData, mode?: string): void {
    broadcastData({ type: 'melody' as const, action: 'set', melody, mode })
  }

  /** A song manifest -- URLs and lyrics, never audio. */
  /**
   * The channel to one peer, for a transfer to drive directly.
   *
   * Handed out rather than wrapped because a transfer needs the channel's
   * bufferedAmount and its bufferedamountlow event to apply backpressure,
   * and a send(payload) wrapper cannot express waiting.
   */
  function channelTo(peerId: string): RTCDataChannel | null {
    return dataChannels.get(peerId) ?? null
  }

  /** The connection to one peer, so a transfer can ask about its route. */
  function connectionTo(peerId: string): RTCPeerConnection | null {
    return peerConnections.get(peerId) ?? null
  }

  /** Tell the room whether this device can hear the loaded song. */
  function sendSongHave(songId: string, have: boolean): void {
    const payload = JSON.stringify({ type: 'song-have', songId, have })
    for (const [, dc] of dataChannels) {
      if (dc.readyState === 'open') dc.send(payload)
    }
  }

  function sendSongFileMessage(peerId: string, msg: object): void {
    const dc = dataChannels.get(peerId)
    if (dc?.readyState === 'open') dc.send(JSON.stringify(msg))
  }

  function sendSong(song: object | null): void {
    broadcastData(
      song === null
        ? { type: 'song' as const, action: 'clear' }
        : { type: 'song' as const, action: 'set', song },
    )
  }

  function sendClearMelody(): void {
    broadcastData({ type: 'melody' as const, action: 'clear' })
  }

  function sendPlaybackCommand(
    action: 'play' | 'pause' | 'stop' | 'seek',
    currentBeat?: number,
    bpm?: number,
  ): void {
    broadcastData({
      type: 'playback' as const,
      action,
      scope: 'drill' as const,
      currentBeat,
      timestamp: Date.now(),
      ...(bpm === undefined ? {} : { bpm }),
    })
  }

  /**
   * Transport for a song, in seconds.
   *
   * A separate function rather than an extra argument, so positionSec and
   * currentBeat can never both be set -- a receiver picks its branch on
   * which one arrived, and "both" has no meaning.
   */
  function sendPlaybackCommandSec(
    action: 'play' | 'pause' | 'stop' | 'seek',
    positionSec: number,
  ): void {
    broadcastData({
      type: 'playback' as const,
      action,
      scope: 'song' as const,
      positionSec,
      timestamp: Date.now(),
    })
  }

  function broadcastData(msg: object): void {
    const raw = JSON.stringify(msg)
    for (const [, dc] of dataChannels) {
      if (dc.readyState === 'open') {
        dc.send(raw)
      }
    }
  }

  // ── ICE recovery ────────────────────────────────────────────────

  /**
   * Restart ICE on a broken pair.
   *
   * Only the IMPOLITE peer restarts. Perfect negotiation can survive both
   * sides restarting at once, but it costs a rollback and a second round
   * trip every time, and on a mesh that multiplies by the number of pairs.
   * The polite side simply waits for the offer -- the same role split the
   * glare handling already uses, so there is one rule to reason about.
   */
  function recoverIce(
    pc: RTCPeerConnection,
    peerId: string,
    reason: string,
  ): void {
    clearIceRecovery(peerId)
    const tries = iceRetries.get(peerId) ?? 0
    const decision = decideIceRestart(signaling.getPeerId(), peerId, tries)
    if (!decision.restart) {
      console.info(
        '[jam:service] ICE',
        reason,
        peerId,
        '- no restart:',
        decision.why,
      )
      return
    }
    iceRetries.set(peerId, tries + 1)
    console.info(
      '[jam:service] ICE',
      reason,
      peerId,
      '- restarting, attempt',
      tries + 1,
    )
    try {
      // Fires negotiationneeded, which the existing handler turns into a
      // fresh offer -- so restart flows through one code path, not two.
      pc.restartIce()
    } catch (err) {
      console.warn('[jam:service] ICE restart failed for', peerId, err)
    }
  }

  function clearIceRecovery(peerId: string): void {
    const timer = iceRecoveryTimers.get(peerId)
    if (timer !== undefined) {
      clearTimeout(timer)
      iceRecoveryTimers.delete(peerId)
    }
  }

  // ── Latency measurement ─────────────────────────────────────────

  async function measureLatency(
    peerId: string,
    pc: RTCPeerConnection,
  ): Promise<void> {
    try {
      const stats = await pc.getStats()
      let rtt = 0
      stats.forEach((report) => {
        if (
          report.type === 'candidate-pair' &&
          'currentRoundTripTime' in report
        ) {
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
    for (const [, dc] of dataChannels) {
      dc.close()
    }
    dataChannels.clear()
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

  function getVideoEnabled(): boolean {
    return videoEnabled
  }

  return {
    createRoom,
    joinRoom,
    leaveRoom,
    setMuted,
    startLocalAudio,
    hasLocalAudio,
    setVideoEnabled,
    startLocalVideo,
    stopLocalVideo,
    sendChat,
    sendPitch,
    sendMelody,
    sendSong,
    channelTo,
    connectionTo,
    sendSongFileMessage,
    sendSongHave,
    sendPlaybackCommandSec,
    sendClearMelody,
    sendPlaybackCommand,
    sendBackgroundCapability,
    setRoomBackground,
    getLocalStream,
    getRoomId,
    getPeerId,
    getVideoEnabled,
    dispose,
  }
}

function mapConnectionState(
  state: RTCPeerConnectionState,
): JamPeer['connectionState'] {
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
