import React, { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, Send, Square, Trash2, Loader2 } from 'lucide-react';
import { extractAudioWaveform } from '../utils/media';

interface VoiceRecorderBarProps {
  onSendVoice: (blob: Blob, durationSec: number, waveform: number[]) => Promise<void>;
  onCancel: () => void;
  onRecordingStateChange?: (recording: boolean) => void;
}

export const VoiceRecorderBar: React.FC<VoiceRecorderBarProps> = ({
  onSendVoice,
  onCancel,
  onRecordingStateChange,
}) => {
  const [status, setStatus] = useState<'recording' | 'paused' | 'preview'>('recording');
  const [seconds, setSeconds] = useState(0);
  const [bars, setBars] = useState<number[]>(new Array(28).fill(0.18));
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const startCapture = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        onRecordingStateChange?.(true);

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (evt) => {
          if (evt.data.size > 0) chunksRef.current.push(evt.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          setRecordedBlob(blob);
          setPreviewUrl(URL.createObjectURL(blob));
          setStatus('preview');
        };

        recorder.start(200);

        // Live AudioContext frequency waveform
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateWave = () => {
          if (!mounted) return;
          analyser.getByteFrequencyData(dataArray);
          const nextBars = Array.from({ length: 28 }, (_, i) => {
            const val = dataArray[i % dataArray.length] || 0;
            return Math.max(0.15, Math.min(1, val / 210));
          });
          setBars(nextBars);
          rafRef.current = requestAnimationFrame(updateWave);
        };
        rafRef.current = requestAnimationFrame(updateWave);

        timerRef.current = window.setInterval(() => {
          setSeconds((s) => s + 1);
        }, 1000);
      } catch {
        setError('Microphone permission denied or unavailable.');
      }
    };

    startCapture();

    return () => {
      mounted = false;
      onRecordingStateChange?.(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  const stopTimerAndTracks = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  };

  const handlePauseResume = () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    if (status === 'recording') {
      rec.pause();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setStatus('paused');
    } else if (status === 'paused') {
      rec.resume();
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      setStatus('recording');
    }
  };

  const handleStop = () => {
    stopTimerAndTracks();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      let blob = recordedBlob;
      if (!blob && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          const rec = mediaRecorderRef.current!;
          rec.onstop = () => {
            blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
            resolve();
          };
          stopTimerAndTracks();
          rec.stop();
        });
      }
      if (!blob) return;
      const waveform = await extractAudioWaveform(blob, 32);
      await onSendVoice(blob, Math.max(1, seconds), waveform);
    } finally {
      setSending(false);
    }
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 w-full px-4 py-2.5 rounded-2xl bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-300">
        <span>{error}</span>
        <button type="button" onClick={onCancel} className="font-semibold underline cursor-pointer">
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 w-full rounded-2xl bg-[#F4FBF6] dark:bg-[#202C33] border border-[#25D366]/50 px-3.5 py-2">
      <button
        type="button"
        onClick={() => {
          stopTimerAndTracks();
          onCancel();
        }}
        className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 cursor-pointer"
        title="Cancel recording"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {status !== 'preview' ? (
        <>
          <div className="flex items-center gap-2 shrink-0">
            <Mic
              className={`w-4 h-4 text-red-500 ${status === 'recording' ? 'animate-pulse' : ''}`}
            />
            <span className="font-mono-nums text-xs font-semibold text-[#111B21] dark:text-white">
              {mm}:{ss}
            </span>
          </div>

          <div className="flex-1 flex items-center gap-0.5 h-7 overflow-hidden">
            {bars.map((h, i) => (
              <div
                key={i}
                style={{ height: `${Math.round(h * 100)}%` }}
                className="flex-1 rounded-full bg-[#25D366] transition-all duration-75"
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handlePauseResume}
            className="p-2 rounded-xl text-[#111B21] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            title={status === 'recording' ? 'Pause' : 'Resume'}
          >
            {status === 'recording' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleStop}
            className="p-2 rounded-xl text-[#128C7E] dark:text-[#25D366] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            title="Stop & Preview"
          >
            <Square className="w-4 h-4" />
          </button>
        </>
      ) : (
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {previewUrl && <audio src={previewUrl} controls className="h-8 flex-1 min-w-0" />}
          <span className="font-mono-nums text-xs text-[#667781] shrink-0">
            {mm}:{ss}
          </span>
        </div>
      )}

      <button
        type="button"
        disabled={sending}
        onClick={handleSend}
        className="p-2.5 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] transition-colors cursor-pointer disabled:opacity-60 shrink-0"
        title="Send voice note"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </button>
    </div>
  );
};
