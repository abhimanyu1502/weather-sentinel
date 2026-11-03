/**
 * soundAlerts.ts — Web Audio API Synthesizer for Disaster Watcher Warning Sounds.
 *
 * Runs 100% client-side with zero external audio assets or network requests.
 * Generates calibrated acoustic alarms for:
 *   1. Emergency Klaxon / Siren (Red Alert / Extreme Convective Anomalies)
 *   2. Warning Sonar Chime (Severe Thunderstorms / High Hail Risk)
 *   3. Radar Instrument Ping (Telemetry packet / Nowcast refresh)
 */

class SoundAlertEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private volume: number = 0.35;

  constructor() {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("stormsentinel_audio_muted");
      this.muted = stored === "true";
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (typeof window !== "undefined") {
      localStorage.setItem("stormsentinel_audio_muted", String(muted));
    }
  }

  public toggleMute(): boolean {
    const next = !this.muted;
    this.setMuted(next);
    if (!next) {
      this.playRadarPing();
    }
    return next;
  }

  /**
   * Emergency Klaxon / Siren for EXTREME / RED ALERT 6-hour anomalies
   * Alternating high-urgency dual-frequency siren (880Hz / 660Hz)
   */
  public playEmergencyAlarm() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      gain.gain.setValueAtTime(0, now);

      // 3 warbling alarm cycles
      for (let i = 0; i < 3; i++) {
        const t = now + i * 0.35;
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(620, t + 0.16);
        osc.frequency.setValueAtTime(880, t + 0.18);
        osc.frequency.exponentialRampToValueAtTime(620, t + 0.32);

        gain.gain.setValueAtTime(this.volume * 0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.33);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.1);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Warning Sonar Chime for SEVERE / WARNING 6-hour anomalies
   * Ascending harmonic chime (740Hz -> 980Hz)
   */
  public playWarningChime() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";

      osc1.frequency.setValueAtTime(740, now);
      osc2.frequency.setValueAtTime(980, now + 0.12);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(this.volume * 0.6, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.25);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);
    } catch {
      // Audio autoplay fallback
    }
  }

  /**
   * Soft Sonar Ping for nowcast stream updates and UI feedback
   */
  public playRadarPing() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.22);

      gain.gain.setValueAtTime(this.volume * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.23);
    } catch {
      // Audio fallback
    }
  }
}

export const soundAlerts = new SoundAlertEngine();
