import type { NotificationPrefs } from '../types/chitchat';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private ringtoneTimer: number | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(freq: number, duration: number, type: OscillatorType, volume: number, delay = 0) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.005, volume * 0.25), ctx.currentTime + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration + 0.02);
    } catch {
      // Respect browser autoplay restrictions silently
    }
  }

  playSent(prefs?: NotificationPrefs) {
    if (prefs && (!prefs.soundEnabled || !prefs.sentSound)) return;
    const vol = prefs?.volume ?? 0.6;
    const pack = prefs?.soundPack ?? 'chime';
    if (pack === 'drop') {
      this.playTone(520, 0.09, 'sine', vol);
      this.playTone(760, 0.11, 'sine', vol, 0.05);
    } else if (pack === 'crystal') {
      this.playTone(880, 0.08, 'triangle', vol);
    } else {
      this.playTone(620, 0.08, 'sine', vol);
      this.playTone(840, 0.1, 'sine', vol, 0.045);
    }
  }

  playReceived(prefs?: NotificationPrefs) {
    if (prefs && (!prefs.soundEnabled || !prefs.receivedSound)) return;
    const vol = prefs?.volume ?? 0.6;
    const pack = prefs?.soundPack ?? 'chime';
    if (pack === 'drop') {
      this.playTone(440, 0.12, 'sine', vol);
      this.playTone(660, 0.14, 'sine', vol, 0.08);
    } else if (pack === 'crystal') {
      this.playTone(987, 0.1, 'triangle', vol);
      this.playTone(1318, 0.14, 'triangle', vol, 0.07);
    } else {
      this.playTone(523.25, 0.11, 'sine', vol);
      this.playTone(659.25, 0.14, 'sine', vol, 0.08);
    }
  }

  playNotification(prefs?: NotificationPrefs) {
    if (prefs && !prefs.soundEnabled) return;
    const vol = prefs?.volume ?? 0.6;
    this.playTone(587.33, 0.1, 'sine', vol);
    this.playTone(880, 0.16, 'sine', vol, 0.09);
  }

  playFriendRequest(prefs?: NotificationPrefs) {
    if (prefs && !prefs.soundEnabled) return;
    const vol = prefs?.volume ?? 0.6;
    this.playTone(523.25, 0.1, 'triangle', vol);
    this.playTone(659.25, 0.1, 'triangle', vol, 0.09);
    this.playTone(783.99, 0.18, 'triangle', vol, 0.18);
  }

  playCallConnected(prefs?: NotificationPrefs) {
    if (prefs && !prefs.soundEnabled) return;
    const vol = prefs?.volume ?? 0.6;
    this.playTone(440, 0.1, 'sine', vol);
    this.playTone(554.37, 0.14, 'sine', vol, 0.09);
  }

  startRingtone(prefs?: NotificationPrefs) {
    this.stopRingtone();
    if (prefs && (!prefs.soundEnabled || !prefs.ringtoneEnabled)) return;
    const vol = prefs?.volume ?? 0.7;
    const ringOnce = () => {
      this.playTone(659.25, 0.18, 'sine', vol, 0);
      this.playTone(830.61, 0.18, 'sine', vol, 0.2);
      this.playTone(659.25, 0.18, 'sine', vol, 0.45);
      this.playTone(830.61, 0.25, 'sine', vol, 0.65);
    };
    ringOnce();
    this.ringtoneTimer = window.setInterval(ringOnce, 2400);
  }

  stopRingtone() {
    if (this.ringtoneTimer !== null) {
      clearInterval(this.ringtoneTimer);
      this.ringtoneTimer = null;
    }
  }
}

export const soundEngine = new SoundEngine();
