import type { Settings } from './model';

type SoundName = 'slash' | 'hit' | 'crit' | 'hurt' | 'dash' | 'shoot' | 'death' | 'gold' | 'pickup' | 'potion' | 'chest' | 'door' | 'level' | 'boss' | 'victory' | 'defeat' | 'warning';
type MusicState = 'calm' | 'combat' | 'boss';

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

export class AudioManager {
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private musicFilter?: BiquadFilterNode;
  private noise?: AudioBuffer;
  private scheduler?: number;
  private nextStepTime = 0;
  private step = 0;
  private musicState: MusicState = 'calm';

  constructor(private settings: Settings) {}

  start(): void {
    if (this.context) { void this.context.resume(); return; }
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    this.context = new AudioCtx();
    this.master = this.context.createGain(); this.music = this.context.createGain(); this.musicFilter = this.context.createBiquadFilter();
    this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 2200; this.musicFilter.Q.value = .7;
    this.music.connect(this.musicFilter).connect(this.master); this.master.connect(this.context.destination);
    this.noise = this.createNoiseBuffer(); this.nextStepTime = this.context.currentTime + .08;
    if (this.scheduler === undefined) this.scheduler = window.setInterval(() => this.scheduleMusic(), 45);
    this.applySettings(this.settings);
  }

  setMusicState(state: MusicState): void {
    if (state === this.musicState) return; this.musicState = state;
    if (!this.context || !this.musicFilter) return;
    const cutoff = state === 'boss' ? 4800 : state === 'combat' ? 3500 : 2200;
    this.musicFilter.frequency.setTargetAtTime(cutoff, this.context.currentTime, .35);
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
    if (!this.context || !this.master || !this.music) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.master, now, .02);
    this.music.gain.setTargetAtTime(settings.music * .72, now, .08);
  }

  private scheduleMusic(): void {
    const context = this.context; if (!context || context.state === 'suspended') return;
    while (this.nextStepTime < context.currentTime + .16) {
      this.scheduleStep(this.step, this.nextStepTime);
      const tempo = this.musicState === 'boss' ? 112 : this.musicState === 'combat' ? 94 : 80;
      this.nextStepTime += 60 / tempo / 4; this.step = (this.step + 1) % 64;
    }
  }

  private scheduleStep(step: number, at: number): void {
    const local = step % 16; const bar = Math.floor(step / 16); const roots = [38, 38, 41, 36]; const root = roots[bar]!;
    if (local === 0) this.chord(root + 12, at, this.musicState === 'calm' ? 2.8 : 1.7);
    if (local === 0 || local === 8 || (this.musicState !== 'calm' && local % 4 === 0)) this.bass(root + (local === 8 ? 7 : 0), at);

    const melody = [null, 69, null, 72, 74, null, 72, null, 69, null, 67, 65, null, 67, 69, null] as const;
    const calmMelody = [null, null, 69, null, null, 72, null, null, null, 67, null, null, 65, null, null, null] as const;
    const note = (this.musicState === 'calm' ? calmMelody : melody)[local];
    if (note !== null) this.bell(note + (bar === 2 ? -2 : 0), at, this.musicState === 'boss' ? .13 : .09);

    if (local === 0 || local === 8) this.kick(at, this.musicState === 'boss' ? .12 : .085);
    if (this.musicState !== 'calm' && (local === 4 || local === 12)) this.tom(at, local === 12 ? 45 : 52);
    if (this.musicState === 'boss' || (this.musicState === 'combat' && local % 2 === 1)) this.hat(at, local % 4 === 3 ? .035 : .022);
  }

  private tone(frequency: number, at: number, duration: number, volume: number, type: OscillatorType, destination = this.music): void {
    if (!this.context || !destination) return; const osc = this.context.createOscillator(); const gain = this.context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, at); gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(volume, at + .018); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    osc.connect(gain).connect(destination); osc.start(at); osc.stop(at + duration + .03);
  }

  private chord(root: number, at: number, duration: number): void {
    this.tone(midi(root), at, duration, .018, 'triangle'); this.tone(midi(root + 7), at + .015, duration, .013, 'sine'); this.tone(midi(root + 12), at + .03, duration, .009, 'sine');
  }

  private bass(note: number, at: number): void {
    if (!this.context || !this.music) return; const osc = this.context.createOscillator(); const gain = this.context.createGain(); const filter = this.context.createBiquadFilter();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(midi(note), at); osc.frequency.exponentialRampToValueAtTime(midi(note - 12), at + .48); filter.type = 'lowpass'; filter.frequency.value = 420;
    gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(.075, at + .015); gain.gain.exponentialRampToValueAtTime(.0001, at + .58);
    osc.connect(filter).connect(gain).connect(this.music); osc.start(at); osc.stop(at + .62);
  }

  private bell(note: number, at: number, volume: number): void {
    this.tone(midi(note), at, .55, volume, 'triangle'); this.tone(midi(note + 12), at, .28, volume * .28, 'sine');
  }

  private kick(at: number, volume: number): void {
    if (!this.context || !this.music) return; const osc = this.context.createOscillator(); const gain = this.context.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(105, at); osc.frequency.exponentialRampToValueAtTime(42, at + .15); gain.gain.setValueAtTime(volume, at); gain.gain.exponentialRampToValueAtTime(.0001, at + .22);
    osc.connect(gain).connect(this.music); osc.start(at); osc.stop(at + .24);
  }

  private tom(at: number, frequency: number): void {
    if (!this.context || !this.music) return; const osc = this.context.createOscillator(); const gain = this.context.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(frequency * 1.8, at); osc.frequency.exponentialRampToValueAtTime(frequency, at + .2); gain.gain.setValueAtTime(.055, at); gain.gain.exponentialRampToValueAtTime(.0001, at + .3);
    osc.connect(gain).connect(this.music); osc.start(at); osc.stop(at + .32);
  }

  private hat(at: number, volume: number): void {
    if (!this.context || !this.music || !this.noise) return; const source = this.context.createBufferSource(); const filter = this.context.createBiquadFilter(); const gain = this.context.createGain();
    source.buffer = this.noise; filter.type = 'highpass'; filter.frequency.value = 5200; gain.gain.setValueAtTime(volume, at); gain.gain.exponentialRampToValueAtTime(.0001, at + .055);
    source.connect(filter).connect(gain).connect(this.music); source.start(at); source.stop(at + .06);
  }

  private createNoiseBuffer(): AudioBuffer | undefined {
    if (!this.context) return; const buffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * .3), this.context.sampleRate); const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1; return buffer;
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
    const [from, to, type, duration] = map[name]; const osc = this.context.createOscillator(); const gain = this.context.createGain(); const now = this.context.currentTime;
    osc.type = type; osc.frequency.setValueAtTime(from, now); osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.12 * this.settings.sfx, now + .008); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain).connect(this.master); osc.start(now); osc.stop(now + duration + .02);
  }
}
