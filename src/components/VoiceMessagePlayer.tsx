import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, FileText, Loader2 } from 'lucide-react';

interface VoiceMessagePlayerProps {
  src: string;
  durationSec?: number;
  waveform?: number[];
  isOwn?: boolean;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  src,
  durationSec = 0,
  waveform = [],
  isOwn = false,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeErr, setTranscribeErr] = useState<string | null>(null);

  const bars = waveform.length > 0 ? waveform : new Array(24).fill(0.4);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
  }, [speed]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => {});
      setPlaying(true);
    }
  };

  const cycleSpeed = () => {
    setSpeed((prev) => (prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1));
  };

  const handleTranscribe = async () => {
    if (transcript) {
      setTranscript(null);
      return;
    }
    setTranscribing(true);
    setTranscribeErr(null);
    try {
      const resp = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaUrl: src }),
      });
      const data = (await resp.json()) as { transcript?: string; error?: string };
      if (!resp.ok) {
        setTranscribeErr(data.error || 'Transcription unavailable.');
      } else {
        setTranscript(data.transcript || '(No speech detected)');
      }
    } catch {
      setTranscribeErr('Failed to reach transcription service.');
    } finally {
      setTranscribing(false);
    }
  };

  const total = durationSec > 0 ? durationSec : 0;
  const displayTime = playing || currentSec > 0 ? currentSec : total;
  const mm = String(Math.floor(displayTime / 60)).padStart(2, '0');
  const ss = String(Math.floor(displayTime % 60)).padStart(2, '0');

  return (
    <div className="space-y-1.5 min-w-[230px] max-w-[290px]">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setCurrentSec(el.currentTime);
          const dur = el.duration || total || 1;
          setProgress(Math.min(1, el.currentTime / dur));
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setCurrentSec(0);
        }}
      />

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={togglePlay}
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
            isOwn
              ? 'bg-[#128C7E] text-white'
              : 'bg-[#25D366] text-[#111B21]'
          }`}
          aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-0.5 h-6">
            {bars.map((amp, i) => {
              const filled = i / bars.length <= progress;
              return (
                <div
                  key={i}
                  style={{ height: `${Math.max(20, Math.round(amp * 100))}%` }}
                  className={`flex-1 rounded-full transition-colors ${
                    filled
                      ? 'bg-[#128C7E] dark:bg-[#25D366]'
                      : 'bg-[#667781]/30 dark:bg-white/25'
                  }`}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono-nums text-[#667781] dark:text-[#A3E4D7]">
            <span>{mm}:{ss}</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={cycleSpeed}
                className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-semibold cursor-pointer"
              >
                {speed}x
              </button>
              <button
                type="button"
                onClick={handleTranscribe}
                title="Transcribe voice message"
                className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 inline-flex items-center gap-1 cursor-pointer"
              >
                {transcribing ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : (
                  <FileText className="w-2.5 h-2.5" />
                )}
                <span>Text</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {transcript && (
        <p className="text-xs italic bg-black/5 dark:bg-black/20 rounded-xl px-2.5 py-1.5 text-[#111B21] dark:text-[#E9EDEF]">
          &ldquo;{transcript}&rdquo;
        </p>
      )}
      {transcribeErr && <p className="text-[11px] text-red-500">{transcribeErr}</p>}
    </div>
  );
};
