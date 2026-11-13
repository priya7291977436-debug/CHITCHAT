import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  RefreshCw,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CallSession, NotificationPrefs, UserPublic } from '../types/chitchat';
import { Avatar } from './Avatar';
import { soundEngine } from '../utils/sounds';
import { updatePresence } from '../services/chitchatDb';

interface CallOverlayProps {
  call: CallSession;
  currentUser: UserPublic;
  peerUser?: UserPublic | null;
  notificationPrefs?: NotificationPrefs;
  onClose: () => void;
}

export const CallOverlay: React.FC<CallOverlayProps> = ({
  call,
  currentUser,
  peerUser,
  notificationPrefs,
  onClose,
}) => {
  const isCaller = call.callerId === currentUser.uid;
  const [liveStatus, setLiveStatus] = useState<CallSession['status']>(call.status);
  const [iceState, setIceState] = useState<string>('Initializing...');
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(call.callType === 'audio');
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [fullscreen, setFullscreen] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const addedCandidatesRef = useRef<Set<string>>(new Set());
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const liveOfferRef = useRef<CallSession['offer'] | undefined>(call.offer);
  const answeredRef = useRef(false);

  const participantIds = [call.callerId, ...call.calleeIds];

  // Ringtone for incoming ringing state
  useEffect(() => {
    if (!isCaller && liveStatus === 'ringing') {
      soundEngine.startRingtone(notificationPrefs);
    } else {
      soundEngine.stopRingtone();
    }
    return () => {
      soundEngine.stopRingtone();
    };
  }, [isCaller, liveStatus]);

  // Call duration timer ONLY when WebRTC ICE state is actually connected
  useEffect(() => {
    if (iceState !== 'Connected') return;
    const t = window.setInterval(() => setDurationSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [iceState]);

  const cleanupMediaAndPc = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    updatePresence(currentUser.uid, 'online');
  };

  const flushPendingCandidates = async (pc: RTCPeerConnection) => {
    if (!pc.remoteDescription) return;
    const queued = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];
    for (const cand of queued) {
      await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
    }
  };

  const setupPeerConnection = async () => {
    const iceResp = await fetch('/api/rtc/ice-servers');
    const iceJson = (await iceResp.json()) as { iceServers: RTCIceServer[] };
    const pc = new RTCPeerConnection({ iceServers: iceJson.iceServers });
    pcRef.current = pc;

    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;

    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
    };

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await addDoc(collection(db, 'calls', call.id, 'candidates'), {
            senderId: currentUser.uid,
            participantIds,
            candidate: event.candidate.toJSON(),
            createdAt: serverTimestamp(),
          });
        } catch {
          // Ignore non-fatal candidate write errors
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        setIceState('Connected');
        soundEngine.playCallConnected(notificationPrefs);
      } else if (state === 'checking') {
        setIceState('Connecting...');
      } else if (state === 'disconnected') {
        setIceState('Reconnecting...');
      } else if (state === 'failed') {
        setIceState('Connection failed');
        setErrorMsg('WebRTC connection could not be established across this network.');
      } else if (state === 'closed') {
        setIceState('Ended');
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: call.callType === 'video' ? { facingMode } : false,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    await updatePresence(currentUser.uid, 'in_call');
    return pc;
  };

  // Caller initiates single RTCPeerConnection and publishes live offer
  useEffect(() => {
    if (!isCaller || pcRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        setIceState('Ringing...');
        const pc = await setupPeerConnection();
        if (cancelled) return;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await updateDoc(doc(db, 'calls', call.id), {
          offer: { type: offer.type, sdp: offer.sdp || '' },
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Microphone or camera permission is required for calls.'
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [call.id, isCaller]);

  // Listen to Call document changes (offer/answer, status changes) & ICE candidates
  useEffect(() => {
    const unsubCall = onSnapshot(doc(db, 'calls', call.id), async (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as CallSession;
      setLiveStatus(data.status);
      if (data.offer) {
        liveOfferRef.current = data.offer;
      }

      if (data.status === 'ended' || data.status === 'declined' || data.status === 'missed') {
        cleanupMediaAndPc();
        onClose();
        return;
      }

      if (isCaller && data.answer && pcRef.current && !pcRef.current.currentRemoteDescription) {
        try {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer as RTCSessionDescriptionInit)
          );
          await flushPendingCandidates(pcRef.current);
        } catch {
          // Ignore duplicate remote desc
        }
      }
    });

    const qCandidates = query(
      collection(db, 'calls', call.id, 'candidates'),
      where('participantIds', 'array-contains', currentUser.uid)
    );
    const unsubCand = onSnapshot(qCandidates, (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type !== 'added') return;
        const candData = change.doc.data() as { senderId: string; candidate: RTCIceCandidateInit };
        if (candData.senderId === currentUser.uid) return;
        if (addedCandidatesRef.current.has(change.doc.id)) return;
        addedCandidatesRef.current.add(change.doc.id);
        if (pcRef.current && pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candData.candidate)).catch(() => {});
        } else {
          pendingCandidatesRef.current.push(candData.candidate);
        }
      });
    });

    return () => {
      unsubCall();
      unsubCand();
      cleanupMediaAndPc();
    };
  }, [call.id]);

  const handleAccept = async () => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    soundEngine.stopRingtone();
    setIceState('Connecting...');
    try {
      const pc = await setupPeerConnection();
      // Wait briefly if offer is still arriving from caller
      let attempts = 0;
      while (!liveOfferRef.current && attempts < 20) {
        await new Promise((r) => setTimeout(r, 150));
        attempts += 1;
      }
      const offer = liveOfferRef.current || call.offer;
      if (!offer) {
        throw new Error('Call offer not available yet. Please try again.');
      }
      await pc.setRemoteDescription(new RTCSessionDescription(offer as RTCSessionDescriptionInit));
      await flushPendingCandidates(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateDoc(doc(db, 'calls', call.id), {
        status: 'connected',
        answer: { type: answer.type, sdp: answer.sdp || '' },
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      answeredRef.current = false;
      setErrorMsg(err instanceof Error ? err.message : 'Failed to answer call.');
    }
  };

  const handleDecline = async () => {
    soundEngine.stopRingtone();
    await updateDoc(doc(db, 'calls', call.id), {
      status: 'declined',
      endedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
    cleanupMediaAndPc();
    onClose();
  };

  const handleEndCall = async () => {
    soundEngine.stopRingtone();
    await updateDoc(doc(db, 'calls', call.id), {
      status: liveStatus === 'ringing' && isCaller ? 'missed' : 'ended',
      endedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
    cleanupMediaAndPc();
    onClose();
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
  };

  const toggleCamera = () => {
    const next = !camOff;
    setCamOff(next);
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
  };

  const switchCamera = async () => {
    if (call.callType !== 'video' || !pcRef.current) return;
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nextMode } });
      const newTrack = newStream.getVideoTracks()[0];
      const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
      if (sender && newTrack) {
        await sender.replaceTrack(newTrack);
      }
      localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
      if (localVideoRef.current) localVideoRef.current.srcObject = newStream;
    } catch {
      // Ignore if single camera device
    }
  };

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (remoteVideoRef.current) {
        await remoteVideoRef.current.requestPictureInPicture();
      }
    } catch {
      // PiP not supported on browser
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {});
    }
  };

  const mm = String(Math.floor(durationSec / 60)).padStart(2, '0');
  const ss = String(durationSec % 60).padStart(2, '0');
  const displayName = isCaller ? peerUser?.displayName || 'CHIT CHAT Call' : call.callerName;
  const displayAvatar = isCaller ? peerUser?.photoURL : call.callerPhotoURL;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-2xl rounded-3xl bg-[#111B21] text-white border border-[#23323B] shadow-2xl overflow-hidden flex flex-col min-h-[460px]"
      >
        <audio ref={remoteAudioRef} autoPlay muted={speakerMuted} />

        {/* Video surface when video call */}
        {call.callType === 'video' ? (
          <div className="relative flex-1 bg-black flex items-center justify-center min-h-[340px]">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={speakerMuted}
              className="w-full h-full object-cover"
            />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-4 right-4 w-32 sm:w-40 aspect-video rounded-2xl object-cover border-2 border-[#25D366] shadow-lg bg-[#202C33]"
            />
            {iceState !== 'Connected' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111B21]/80 space-y-3">
                <Avatar src={displayAvatar} name={displayName} size="xl" />
                <h3 className="font-display text-xl font-bold">{displayName}</h3>
                <p className="text-sm text-[#25D366] font-mono-nums">{iceState}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-4">
            <div className="relative">
              {liveStatus === 'ringing' && (
                <span className="absolute -inset-3 rounded-full border-2 border-[#25D366]/50 animate-ping" />
              )}
              <Avatar src={displayAvatar} name={displayName} size="xl" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-display text-2xl font-bold">{displayName}</h3>
              <p className="text-sm text-[#25D366] font-mono-nums">
                {iceState === 'Connected' ? `${mm}:${ss}` : iceState}
              </p>
              {call.mode === 'group' && (
                <p className="text-xs text-[#8696A0]">Group Voice Call</p>
              )}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mx-6 mb-3 rounded-xl bg-red-500/20 border border-red-500/40 px-4 py-2 text-xs text-red-200 text-center">
            {errorMsg}
          </div>
        )}

        {/* Controls Bar */}
        <div className="px-6 py-5 bg-[#0B141A] border-t border-[#23323B] flex items-center justify-center gap-3 flex-wrap">
          {!isCaller && liveStatus === 'ringing' ? (
            <>
              <button
                type="button"
                onClick={handleDecline}
                className="inline-flex items-center gap-2 rounded-full bg-red-500 hover:bg-red-600 px-6 py-3 text-sm font-semibold text-white cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Decline</span>
              </button>
              <button
                type="button"
                onClick={handleAccept}
                className="inline-flex items-center gap-2 rounded-full bg-[#25D366] hover:bg-[#20bd5a] px-6 py-3 text-sm font-semibold text-[#111B21] cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>Accept</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleMute}
                className={`p-3.5 rounded-full transition-colors cursor-pointer ${
                  muted ? 'bg-red-500/20 text-red-400' : 'bg-[#202C33] hover:bg-[#2A3942]'
                }`}
                title={muted ? 'Unmute mic' : 'Mute mic'}
              >
                {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={() => setSpeakerMuted((s) => !s)}
                className={`p-3.5 rounded-full transition-colors cursor-pointer ${
                  speakerMuted ? 'bg-amber-500/20 text-amber-400' : 'bg-[#202C33] hover:bg-[#2A3942]'
                }`}
                title={speakerMuted ? 'Unmute speaker' : 'Mute speaker'}
              >
                {speakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              {call.callType === 'video' && (
                <>
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className={`p-3.5 rounded-full transition-colors cursor-pointer ${
                      camOff ? 'bg-red-500/20 text-red-400' : 'bg-[#202C33] hover:bg-[#2A3942]'
                    }`}
                    title={camOff ? 'Turn camera on' : 'Turn camera off'}
                  >
                    {camOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  </button>
                  <button
                    type="button"
                    onClick={switchCamera}
                    className="p-3.5 rounded-full bg-[#202C33] hover:bg-[#2A3942] cursor-pointer"
                    title="Switch camera"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={togglePiP}
                    className="p-3.5 rounded-full bg-[#202C33] hover:bg-[#2A3942] cursor-pointer"
                    title="Picture-in-Picture"
                  >
                    <PictureInPicture2 className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="p-3.5 rounded-full bg-[#202C33] hover:bg-[#2A3942] cursor-pointer"
                    title="Toggle fullscreen"
                  >
                    {fullscreen ? (
                      <Minimize2 className="w-5 h-5" />
                    ) : (
                      <Maximize2 className="w-5 h-5" />
                    )}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleEndCall}
                className="p-3.5 px-6 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold flex items-center gap-2 cursor-pointer"
                title="End call"
              >
                <PhoneOff className="w-5 h-5" />
                <span className="text-sm">End</span>
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
