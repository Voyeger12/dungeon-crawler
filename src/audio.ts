import type { Settings } from './model';

type SoundName = 'slash' | 'hit' | 'crit' | 'hurt' | 'dash' | 'shoot' | 'death' | 'gold' | 'pickup' | 'potion' | 'chest' | 'door' | 'level' | 'boss' | 'victory' | 'defeat' | 'warning';

export class AudioManager {
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private drone?: OscillatorNode;
  private droneHigh?: OscillatorNode;

  constructor(private settings: Settings) {}

  start(): void {
    if (this.context) { void this.context.resume(); return; }
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    this.context = new AudioCtx();
    this.master = this.context.createGain(); this.music = this.context.createGain();
    this.music.connect(this.master); this.master.connect(this.context.destination);
    this.drone = this.context.createOscillator(); this.droneHigh = this.context.createOscillator();
    this.drone.type = 'triangle'; this.drone.frequency.value = 55;
    this.droneHigh.type = 'sine'; this.droneHigh.frequency.value = 82.4;
    const low = this.context.createGain(); const high = this.context.createGain(); low.gain.value = 0.045; high.gain.value = 0.018;
    this.drone.connect(low).connect(this.music); this.droneHigh.connect(high).connect(this.music);
    this.drone.start(); this.droneHigh.start(); this.applySettings(this.settings);
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
    if (!this.context || !this.master || !this.music) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.master, now, 0.02);
    this.music.gain.setTargetAtTime(settings.music, now, 0.02);
  }

  play(name: SoundName): void {
    if (!this.context || !this.master || this.settings.muted) return;
    const map: Record<SoundName, [number, number, OscillatorType, number]> = {
      slash: [180, 80, 'sawtooth', .09], hit: [95, 48, 'square', .08], crit: [310, 70, 'sawtooth', .14],
      hurt: [130, 62, 'square', .16], dash: [420, 110, 'sine', .1], shoot: [520, 230, 'triangle', .12],
      death: [150, 38, 'sawtooth', .22], gold: [720, 980, 'sine', .09], pickup: [420, 680, 'sine', .12],
      potion: [260, 540, 'sine', .18], chest: [180, 420, 'triangle', .24], door: [70, 45, 'square', .24],
      level: [330, 880, 'sine', .45], boss: [64, 36, 'sawtooth', .7], victory: [392, 784, 'triangle', .8],
      defeat: [180, 42, 'triangle', .8], warning: [250, 210, 'square', .1]
    };
    const [from, to, type, duration] = map[name];
    const osc = this.context.createOscillator(); const gain = this.context.createGain();
    const now = this.context.currentTime; osc.type = type; osc.frequency.setValueAtTime(from, now); osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.12 * this.settings.sfx, now + .008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.master); osc.start(now); osc.stop(now + duration + .02);
  }
}
