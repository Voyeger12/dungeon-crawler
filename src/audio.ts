import type { Settings } from './model';

type SoundName = 'slash' | 'hit' | 'crit' | 'hurt' | 'dash' | 'shoot' | 'death' | 'gold' | 'pickup' | 'potion' | 'chest' | 'door' | 'level' | 'boss' | 'victory' | 'defeat' | 'warning';
export type MusicState = 'menu' | 'intro' | 'calm' | 'combat' | 'boss';
export type AudioScene = MusicState | 'levelup';
export interface AudioSnapshot { scene: MusicState; }

export type ScoreTrackId = 'oath' | 'omen' | 'vault' | 'clash' | 'crown';
export interface ScoreTrack {
  path: string;
  title: string;
  loop: boolean;
}

export const SCORE_TRACKS: Readonly<Record<ScoreTrackId, ScoreTrack>> = {
  oath: { path: '/assets/audio/music/broken-crown-oath.mp3', title: 'Broken Crown Oath', loop: true },
  omen: { path: '/assets/audio/music/runedeep-omen.mp3', title: 'Runedeep Omen', loop: false },
  vault: { path: '/assets/audio/music/runedeep-vault.mp3', title: 'Runedeep Vault', loop: true },
  clash: { path: '/assets/audio/music/runedeep-clash.mp3', title: 'Runedeep Clash', loop: true },
  crown: { path: '/assets/audio/music/runedeep-crown.mp3', title: 'Runedeep Crown', loop: true }
};

export const SCORE_SCENES: Readonly<Record<MusicState, ScoreTrackId>> = {
  menu: 'oath',
  intro: 'omen',
  calm: 'vault',
  combat: 'clash',
  boss: 'crown'
};

export const SCORE_CROSSFADE_SECONDS = 2.2;

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

type DrumVoice = 'frame' | 'war' | 'rattle';
interface MusicProfile {
  roots: readonly (readonly number[])[];
  melodies: readonly (readonly (number | null)[])[];
}

interface ScorePlayer {
  id: ScoreTrackId;
  element: HTMLAudioElement;
  gain: GainNode;
}

export const MUSIC_TEMPOS: Readonly<Record<MusicState, number>> = { menu: 68, intro: 80, calm: 72, combat: 104, boss: 122 };

const MUSIC_PROFILES: Readonly<Record<MusicState, MusicProfile>> = {
  menu: {
    roots: [[38, 41, 36, 38], [38, 36, 43, 41], [43, 41, 38, 36]],
    melodies: [
      [62, null, 65, null, 67, null, 69, null, 67, null, 65, null, 64, null, 62, null],
      [69, null, null, 67, 65, null, 64, null, 62, null, 64, null, 65, null, 62, null],
      [67, null, 69, null, 70, null, 69, null, 67, null, 65, null, 64, null, 62, null]
    ]
  },
  intro: {
    roots: [[38, 36, 41, 43], [38, 41, 36, 43], [43, 41, 38, 36]],
    melodies: [
      [62, null, 65, null, 67, null, 69, 67, 65, null, 64, null, 62, null, 60, null],
      [62, null, 64, 65, 67, null, 69, null, 70, null, 69, 67, 65, null, 62, null],
      [69, null, 67, null, 65, 64, 62, null, 60, null, 62, 64, 65, null, 62, null]
    ]
  },
  calm: {
    roots: [[38, 41, 36, 38], [38, 36, 43, 41], [43, 41, 38, 36]],
    melodies: [
      [62, null, 65, null, 67, null, 69, null, 67, null, 65, null, 64, null, 62, null],
      [69, null, null, 67, 65, null, 64, null, 62, null, 64, null, 65, null, 62, null],
      [67, null, 69, null, 70, null, 69, null, 67, null, 65, null, 64, null, 62, null]
    ]
  },
  combat: {
    roots: [[38, 36, 41, 43], [38, 41, 43, 36], [43, 41, 38, 36]],
    melodies: [
      [74, null, 72, 74, 77, null, 74, 72, 70, null, 72, 74, 72, null, 69, 70],
      [69, 72, null, 74, 72, null, 70, 69, 67, 69, null, 72, 74, null, 72, 69],
      [74, null, 77, 79, 77, 74, 72, null, 70, 72, 74, null, 72, 70, 69, null]
    ]
  },
  boss: {
    roots: [[38, 39, 36, 37], [38, 36, 39, 37], [39, 38, 36, 37]],
    melodies: [
      [62, 63, null, 69, 68, null, 65, 63, 62, 60, 63, null, 68, 65, 63, 61],
      [69, null, 68, 63, 62, 63, null, 60, 61, 63, 68, null, 65, 63, 61, 60],
      [62, 68, 69, null, 63, 61, 60, 63, 65, null, 68, 69, 63, 61, 60, null]
    ]
  }
};

export interface MusicStepPlan {
  root: number;
  openFifth: boolean;
  bass?: number;
  lute?: number;
  reed?: number;
  bell?: number;
  drums: readonly DrumVoice[];
}

export function getMusicStepPlan(state: MusicState, step: number, variation = 0): MusicStepPlan {
  const profile = MUSIC_PROFILES[state];
  const normalizedStep = ((Math.trunc(step) % 64) + 64) % 64;
  const bar = Math.floor(normalizedStep / 16); const local = normalizedStep % 16;
  const variant = ((Math.trunc(variation) % profile.roots.length) + profile.roots.length) % profile.roots.length;
  const root = profile.roots[variant]![bar]!;
  const melodicNote = profile.melodies[variant]![local] ?? undefined;
  const gentle = state === 'calm' || state === 'menu';
  const ostinato = state === 'boss' ? [12, 13, 19, 18] : [12, 19, 22, 19];
  const lute = gentle ? melodicNote : local % 2 === 0 ? root + ostinato[(local / 2) % ostinato.length]! : undefined;
  const reed = gentle ? (bar % 2 === 1 && (local === 4 || local === 12) ? melodicNote : undefined) : melodicNote;
  const bass = gentle ? (local === 0 || local === 8 ? root + (local === 8 ? 7 : 0) : undefined)
    : local % 4 === 0 ? root + (local === 8 ? 7 : 0) : undefined;
  const bell = gentle && local === 0 && bar % 2 === 0 ? root + 31 : state === 'boss' && local === 15 ? root + 24 : undefined;
  const drums: DrumVoice[] = [];
  if (gentle) {
    if (local === 0 || local === 8) drums.push('frame');
    if (local === 6 || local === 14) drums.push('rattle');
  } else if (state === 'intro') {
    if (local === 0 || local === 8) drums.push(bar < 2 ? 'frame' : 'war');
    if (local === 6 || local === 14) drums.push('rattle');
  } else if (state === 'combat') {
    if ([0, 6, 8, 14].includes(local)) drums.push('war');
    if (local === 4 || local === 12) drums.push('frame');
    if (local % 2 === 1) drums.push('rattle');
  } else {
    if ([0, 3, 6, 8, 11, 14].includes(local)) drums.push('war');
    if (local === 4 || local === 12) drums.push('frame');
    if (local % 2 === 1) drums.push('rattle');
  }
  return { root, openFifth: local === 0, bass, lute, reed, bell, drums };
}

export class AudioManager {
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private score?: GainNode;
  private fanfare?: GainNode;
  private musicFilter?: BiquadFilterNode;
  private scoreFilter?: BiquadFilterNode;
  private noise?: AudioBuffer;
  private scheduler?: number;
  private nextStepTime = 0;
  private step = 0;
  private variation = 0;
  private musicState: MusicState = 'calm';
  private scene: AudioScene = 'calm';
  private levelSnapshot?: AudioSnapshot;
  private scorePlayers = new Map<ScoreTrackId, ScorePlayer>();
  private activeScore?: ScorePlayer;
  private scoreReady = false;
  private scorePlaying = false;
  private scoreLoad?: Promise<boolean>;

  constructor(private settings: Settings) {}

  start(): void {
    if (this.context) {
      void this.context.resume();
      if (!this.scoreReady) void this.preloadScore();
      return;
    }
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    this.context = new AudioCtx();
    this.master = this.context.createGain(); this.music = this.context.createGain(); this.score = this.context.createGain(); this.fanfare = this.context.createGain();
    this.musicFilter = this.context.createBiquadFilter(); this.scoreFilter = this.context.createBiquadFilter();
    this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 2200; this.musicFilter.Q.value = .7;
    this.scoreFilter.type = 'lowpass'; this.scoreFilter.frequency.value = 2400; this.scoreFilter.Q.value = .55;
    this.music.connect(this.musicFilter).connect(this.master); this.score.connect(this.scoreFilter).connect(this.master);
    this.fanfare.connect(this.master); this.master.connect(this.context.destination);
    this.noise = this.createNoiseBuffer(); this.nextStepTime = this.context.currentTime + .08;
    if (this.scheduler === undefined) this.scheduler = window.setInterval(() => this.scheduleMusic(), 45);
    this.applySettings(this.settings);
    void this.preloadScore();
  }

  setMusicState(state: MusicState): void {
    if (this.scene === 'levelup' && this.levelSnapshot) { this.levelSnapshot.scene = state; return; }
    if (state === this.musicState && state === this.scene) return;
    const previous = this.musicState; this.musicState = state; this.scene = state; this.variation = (this.variation + 1) % 3; this.step = 0;
    if (!this.context || !this.musicFilter || !this.music) return;
    const now = this.context.currentTime;
    const cutoff = state === 'boss' ? 5200 : state === 'combat' ? 3900 : state === 'intro' ? 3200 : state === 'menu' ? 2200 : 2400;
    this.nextStepTime = now + .09;
    this.musicFilter.frequency.cancelScheduledValues(now); this.musicFilter.frequency.setTargetAtTime(cutoff, now, .24);
    if (this.scoreReady) {
      this.playScoreForState(state);
      this.updateScoreMix(now);
    } else {
      this.music.gain.cancelScheduledValues(now); this.music.gain.setTargetAtTime(this.settings.music * .34, now, .04); this.music.gain.setTargetAtTime(this.settings.music * .78, now + .12, .18);
      this.transitionCue(previous, state, now + .035);
    }
  }

  captureScene(): AudioSnapshot {
    return this.scene === 'levelup' && this.levelSnapshot ? { ...this.levelSnapshot } : { scene: this.musicState };
  }

  beginLevelUp(snapshot: AudioSnapshot = this.captureScene(), stacked = false): void {
    this.levelSnapshot = { ...snapshot }; this.scene = 'levelup';
    if (this.context && this.music && this.musicFilter) {
      const now = this.context.currentTime;
      this.music.gain.cancelScheduledValues(now); this.music.gain.setTargetAtTime(this.settings.music * .2, now, .1);
      this.musicFilter.frequency.cancelScheduledValues(now); this.musicFilter.frequency.setTargetAtTime(900, now, .12);
      if (this.score && this.scoreFilter) {
        this.score.gain.cancelScheduledValues(now); this.score.gain.setTargetAtTime(this.settings.music * .17, now, .12);
        this.scoreFilter.frequency.cancelScheduledValues(now); this.scoreFilter.frequency.setTargetAtTime(900, now, .12);
      }
    }
    this.playLevelUpFanfare(stacked);
  }

  playLevelUpFanfare(stacked = false): void {
    if (!this.context || !this.fanfare || this.settings.muted || this.settings.music <= 0) return;
    const now = this.context.currentTime + .025;
    if (stacked) {
      this.tone(midi(72), now, .28, .075, 'triangle', this.fanfare);
      this.tone(midi(79), now + .1, .42, .065, 'sine', this.fanfare);
      return;
    }
    this.tone(midi(72), now, .38, .1, 'sine', this.fanfare);
    this.tone(midi(60), now + .04, .65, .075, 'triangle', this.fanfare);
    this.tone(midi(64), now + .2, .72, .07, 'triangle', this.fanfare);
    this.tone(midi(67), now + .36, .82, .07, 'triangle', this.fanfare);
    this.tone(midi(72), now + .52, .95, .085, 'sine', this.fanfare);
    this.tone(midi(79), now + .55, .7, .035, 'sine', this.fanfare);
  }

  playLevelUpConfirm(): void {
    if (!this.context || !this.master || this.settings.muted || this.settings.sfx <= 0) return;
    const now = this.context.currentTime;
    this.tone(midi(67), now, .2, .07 * this.settings.sfx, 'triangle', this.master);
    this.tone(midi(72), now + .07, .32, .085 * this.settings.sfx, 'sine', this.master);
  }

  playLevelUpReroll(): void {
    if (!this.context || !this.master || this.settings.muted || this.settings.sfx <= 0) return;
    const now = this.context.currentTime;
    this.tone(midi(43), now, .16, .055 * this.settings.sfx, 'square', this.master);
    this.tone(midi(55), now + .07, .24, .06 * this.settings.sfx, 'triangle', this.master);
    this.tone(midi(62), now + .15, .32, .075 * this.settings.sfx, 'sine', this.master);
    this.tone(midi(74), now + .23, .38, .05 * this.settings.sfx, 'sine', this.master);
    this.play('gold');
  }

  restoreScene(snapshot: AudioSnapshot = this.levelSnapshot ?? { scene: 'calm' }): void {
    this.levelSnapshot = undefined; this.scene = snapshot.scene; this.musicState = snapshot.scene;
    if (!this.context || !this.music || !this.musicFilter) return;
    const now = this.context.currentTime;
    const cutoff = snapshot.scene === 'boss' ? 5200 : snapshot.scene === 'combat' ? 3900 : snapshot.scene === 'intro' ? 3200 : snapshot.scene === 'menu' ? 2200 : 2400;
    if (this.scoreReady) {
      this.playScoreForState(snapshot.scene);
      this.updateScoreMix(now);
    } else {
      this.music.gain.cancelScheduledValues(now); this.music.gain.setTargetAtTime(this.settings.music * .78, now, .18);
    }
    this.musicFilter.frequency.cancelScheduledValues(now); this.musicFilter.frequency.setTargetAtTime(cutoff, now, .24);
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
    if (!this.context || !this.master || !this.music || !this.fanfare) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.master, now, .02);
    this.music.gain.setTargetAtTime(this.scoreReady && this.scorePlaying ? .0001 : settings.music * (this.scene === 'levelup' ? .2 : .78), now, .08);
    if (this.score) this.score.gain.setTargetAtTime(this.scoreReady && this.scorePlaying ? settings.music * this.scoreLevel() : .0001, now, .08);
    this.fanfare.gain.setTargetAtTime(settings.music * .82, now, .08);
  }

  preloadScore(): Promise<boolean> {
    if (!this.scoreLoad) this.scoreLoad = this.prepareScorePlayers();
    return this.scoreLoad;
  }

  hasSampleScore(): boolean {
    return this.scoreReady;
  }

  /*
   * The long masters stay compressed in HTMLAudioElements. Routing them through
   * Web Audio preserves the shared mixer without decoding roughly 286 MB of PCM.
   */
  private async prepareScorePlayers(): Promise<boolean> {
    const context = this.context;
    if (!context || !this.score || typeof context.createMediaElementSource !== 'function' || typeof window.Audio !== 'function') return false;
    try {
      if (this.scorePlayers.size !== Object.keys(SCORE_TRACKS).length) {
        for (const id of Object.keys(SCORE_TRACKS) as ScoreTrackId[]) {
          if (this.scorePlayers.has(id)) continue;
          const track = SCORE_TRACKS[id];
          const element = new window.Audio();
          element.preload = 'auto'; element.loop = track.loop; element.src = track.path;
          const source = context.createMediaElementSource(element); const gain = context.createGain();
          gain.gain.value = .0001; source.connect(gain).connect(this.score);
          element.load();
          this.scorePlayers.set(id, { id, element, gain });
        }
      }
      if (this.context !== context) return false;
      this.scoreReady = this.scorePlayers.size === Object.keys(SCORE_TRACKS).length;
      if (!this.scoreReady) return false;
      this.playScoreForState(this.musicState, true);
      this.applySettings(this.settings);
      return true;
    } catch (error) {
      for (const player of this.scorePlayers.values()) player.element.pause();
      this.scorePlayers.clear();
      console.warn('Die Runedeep-Musik konnte nicht vorbereitet werden; der prozedurale Soundtrack bleibt aktiv.', error);
      return false;
    }
  }

  private playScoreForState(state: MusicState, initial = false): void {
    const context = this.context;
    if (!context || !this.scoreReady) return;
    const id = SCORE_SCENES[state];
    if (this.activeScore?.id === id) return;
    const incoming = this.scorePlayers.get(id);
    if (!incoming) return;
    const now = context.currentTime;
    const outgoing = this.activeScore;
    if (outgoing) {
      outgoing.gain.gain.cancelScheduledValues(now);
      outgoing.gain.gain.setValueAtTime(Math.max(.0001, outgoing.gain.gain.value), now);
      outgoing.gain.gain.setTargetAtTime(.0001, now, SCORE_CROSSFADE_SECONDS / 5);
      window.setTimeout(() => {
        if (this.activeScore?.id !== outgoing.id) outgoing.element.pause();
      }, (SCORE_CROSSFADE_SECONDS + .15) * 1000);
    }
    const fade = initial && !outgoing ? .9 : SCORE_CROSSFADE_SECONDS;
    if (!SCORE_TRACKS[id].loop) incoming.element.currentTime = 0;
    incoming.gain.gain.cancelScheduledValues(now);
    incoming.gain.gain.setValueAtTime(Math.max(.0001, incoming.gain.gain.value), now);
    incoming.gain.gain.setTargetAtTime(1, now, fade / 5);
    this.activeScore = incoming;
    const playback = incoming.element.play();
    if (playback && typeof playback.catch === 'function') {
      void playback.then(() => {
        if (this.activeScore?.id !== incoming.id || !this.context) return;
        this.scorePlaying = true;
        this.updateScoreMix(this.context.currentTime);
      }).catch((error: unknown) => {
          const name = error instanceof DOMException ? error.name : '';
          if (name === 'AbortError' || this.activeScore?.id !== incoming.id) return;
          this.disableSampleScore(error);
        });
    } else {
      this.scorePlaying = true;
      this.updateScoreMix(now);
    }
  }

  private disableSampleScore(error: unknown): void {
    this.scoreReady = false; this.scorePlaying = false; this.scoreLoad = undefined;
    for (const player of this.scorePlayers.values()) {
      player.element.pause();
      if (this.context) player.gain.gain.setValueAtTime(.0001, this.context.currentTime);
    }
    this.activeScore = undefined;
    if (this.context && this.music && this.score) {
      const now = this.context.currentTime;
      this.score.gain.setTargetAtTime(.0001, now, .05);
      this.music.gain.setTargetAtTime(this.settings.music * (this.scene === 'levelup' ? .2 : .78), now, .08);
      this.nextStepTime = now + .08;
    }
    console.warn('Die Runedeep-Musik konnte nicht wiedergegeben werden; der prozedurale Soundtrack übernimmt.', error);
  }

  private updateScoreMix(now: number): void {
    if (!this.score || !this.scoreFilter || !this.music) return;
    const cutoff = this.musicState === 'boss' ? 7200 : this.musicState === 'combat' ? 5600 : this.musicState === 'intro' ? 4400 : this.musicState === 'menu' ? 3200 : 3600;
    this.scoreFilter.frequency.cancelScheduledValues(now); this.scoreFilter.frequency.setTargetAtTime(cutoff, now, .3);
    this.score.gain.cancelScheduledValues(now); this.score.gain.setTargetAtTime(this.scorePlaying ? this.settings.music * this.scoreLevel() : .0001, now, .18);
    this.music.gain.cancelScheduledValues(now);
    this.music.gain.setTargetAtTime(this.scorePlaying ? .0001 : this.settings.music * (this.scene === 'levelup' ? .2 : .78), now, .12);
  }

  private scoreLevel(): number {
    if (this.scene === 'levelup') return .17;
    return this.musicState === 'boss' ? .9 : this.musicState === 'combat' ? .82 : this.musicState === 'intro' ? .74 : this.musicState === 'menu' ? .64 : .7;
  }

  private scheduleMusic(): void {
    const context = this.context; if (!context || context.state === 'suspended' || (this.scoreReady && this.scorePlaying)) return;
    while (this.nextStepTime < context.currentTime + .16) {
      this.scheduleStep(this.step, this.nextStepTime);
      this.nextStepTime += 60 / MUSIC_TEMPOS[this.musicState] / 4; this.step = (this.step + 1) % 64;
      if (this.step === 0) this.variation = (this.variation + 1) % 3;
    }
  }

  private scheduleStep(step: number, at: number): void {
    const plan = getMusicStepPlan(this.musicState, step, this.variation);
    const intensity = this.musicState === 'boss' ? 1 : this.musicState === 'combat' ? .78 : this.musicState === 'intro' ? .62 : this.musicState === 'menu' ? .43 : .5;
    if (plan.openFifth) this.openFifth(plan.root + 12, at, .038 * intensity);
    if (plan.bass !== undefined) this.bass(plan.bass, at, .052 * intensity);
    if (plan.lute !== undefined) this.lute(plan.lute, at, (this.musicState === 'calm' || this.musicState === 'menu' ? .045 : .034) * intensity);
    if (plan.reed !== undefined) this.reed(plan.reed, at, .035 * intensity, this.musicState === 'boss' ? .42 : .34);
    if (plan.bell !== undefined) this.bell(plan.bell, at, .026 * intensity);
    for (const drum of plan.drums) {
      if (drum === 'war') this.warDrum(at, .105 * intensity);
      else if (drum === 'frame') this.frameDrum(at, .055 * intensity);
      else this.rattle(at, .018 * intensity);
    }
  }

  private tone(frequency: number, at: number, duration: number, volume: number, type: OscillatorType, destination = this.music): void {
    if (!this.context || !destination) return; const osc = this.context.createOscillator(); const gain = this.context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, at); gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(volume, at + .018); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    osc.connect(gain).connect(destination); osc.start(at); osc.stop(at + duration + .03);
  }

  private transitionCue(previous: MusicState, next: MusicState, at: number): void {
    if (previous === next) return;
    if (next === 'boss') {
      this.warDrum(at, .11); this.warDrum(at + .11, .095); this.warDrum(at + .22, .13);
      this.reed(62, at + .04, .035, .46); this.reed(63, at + .29, .042, .58);
    } else if (next === 'combat') {
      this.frameDrum(at, .065); this.warDrum(at + .13, .085);
      this.reed(62, at + .04, .03, .34); this.reed(69, at + .24, .032, .42);
    } else if (next === 'intro') {
      this.bell(62, at, .02); this.frameDrum(at + .18, .045); this.reed(65, at + .25, .026, .42);
    } else {
      this.bell(69, at, .025); this.bell(65, at + .16, .021); this.bell(62, at + .34, .018);
    }
  }

  private openFifth(root: number, at: number, volume: number): void {
    this.lute(root, at, volume); this.lute(root + 7, at + .024, volume * .78); this.lute(root + 12, at + .048, volume * .58);
  }

  private lute(note: number, at: number, volume: number): void {
    if (!this.context || !this.music) return;
    const osc = this.context.createOscillator(); const harmonic = this.context.createOscillator(); const filter = this.context.createBiquadFilter(); const gain = this.context.createGain();
    osc.type = 'triangle'; harmonic.type = 'sine'; osc.frequency.setValueAtTime(midi(note), at); harmonic.frequency.setValueAtTime(midi(note + 12), at);
    filter.type = 'lowpass'; filter.Q.value = 1.4; filter.frequency.setValueAtTime(2600, at); filter.frequency.exponentialRampToValueAtTime(620, at + .38);
    gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(volume, at + .006); gain.gain.exponentialRampToValueAtTime(.0001, at + .42);
    osc.connect(filter); harmonic.connect(filter); filter.connect(gain).connect(this.music); osc.start(at); harmonic.start(at); osc.stop(at + .45); harmonic.stop(at + .45);
  }

  private reed(note: number, at: number, volume: number, duration: number): void {
    if (!this.context || !this.music) return;
    const body = this.context.createOscillator(); const breath = this.context.createOscillator(); const filter = this.context.createBiquadFilter(); const gain = this.context.createGain();
    body.type = 'sawtooth'; breath.type = 'triangle'; body.frequency.setValueAtTime(midi(note), at); breath.frequency.setValueAtTime(midi(note), at); breath.detune.value = -8;
    filter.type = 'lowpass'; filter.frequency.value = 1750; filter.Q.value = 3.2;
    gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(volume, at + .035); gain.gain.setValueAtTime(volume * .72, at + duration * .62); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    body.connect(filter); breath.connect(filter); filter.connect(gain).connect(this.music); body.start(at); breath.start(at); body.stop(at + duration + .02); breath.stop(at + duration + .02);
  }

  private bass(note: number, at: number, volume: number): void {
    if (!this.context || !this.music) return; const osc = this.context.createOscillator(); const gain = this.context.createGain(); const filter = this.context.createBiquadFilter();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(midi(note), at); filter.type = 'lowpass'; filter.frequency.value = 360; filter.Q.value = .8;
    gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(volume, at + .018); gain.gain.exponentialRampToValueAtTime(.0001, at + .44);
    osc.connect(filter).connect(gain).connect(this.music); osc.start(at); osc.stop(at + .47);
  }

  private bell(note: number, at: number, volume: number): void {
    this.tone(midi(note), at, .55, volume, 'triangle'); this.tone(midi(note + 12), at, .28, volume * .28, 'sine');
  }

  private warDrum(at: number, volume: number): void {
    if (!this.context || !this.music) return; const osc = this.context.createOscillator(); const gain = this.context.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(92, at); osc.frequency.exponentialRampToValueAtTime(47, at + .18); gain.gain.setValueAtTime(volume, at); gain.gain.exponentialRampToValueAtTime(.0001, at + .3);
    osc.connect(gain).connect(this.music); osc.start(at); osc.stop(at + .32);
  }

  private frameDrum(at: number, volume: number): void {
    if (!this.context || !this.music || !this.noise) return;
    const source = this.context.createBufferSource(); const noiseFilter = this.context.createBiquadFilter(); const noiseGain = this.context.createGain(); const body = this.context.createOscillator(); const bodyGain = this.context.createGain();
    source.buffer = this.noise; noiseFilter.type = 'bandpass'; noiseFilter.frequency.value = 1050; noiseFilter.Q.value = .65;
    noiseGain.gain.setValueAtTime(volume, at); noiseGain.gain.exponentialRampToValueAtTime(.0001, at + .12);
    body.type = 'triangle'; body.frequency.setValueAtTime(180, at); body.frequency.exponentialRampToValueAtTime(105, at + .16); bodyGain.gain.setValueAtTime(volume * .72, at); bodyGain.gain.exponentialRampToValueAtTime(.0001, at + .2);
    source.connect(noiseFilter).connect(noiseGain).connect(this.music); body.connect(bodyGain).connect(this.music); source.start(at); body.start(at); source.stop(at + .14); body.stop(at + .22);
  }

  private rattle(at: number, volume: number): void {
    if (!this.context || !this.music || !this.noise) return; const source = this.context.createBufferSource(); const filter = this.context.createBiquadFilter(); const gain = this.context.createGain();
    source.buffer = this.noise; filter.type = 'bandpass'; filter.frequency.value = 3100; filter.Q.value = .75; gain.gain.setValueAtTime(volume, at); gain.gain.exponentialRampToValueAtTime(.0001, at + .075);
    source.connect(filter).connect(gain).connect(this.music); source.start(at); source.stop(at + .085);
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
