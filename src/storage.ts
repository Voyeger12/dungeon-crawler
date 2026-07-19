import type { Records, Settings, TutorialId, TutorialProgress } from './model';

const KEY = 'rune-deep-save-v3';
const LEGACY_KEY = 'rune-deep-save-v2';
const TUTORIAL_IDS: TutorialId[] = ['move', 'attack', 'dash', 'potion', 'interact', 'character', 'map', 'gold', 'key'];
export const defaultSettings: Settings = { master: 0.8, music: 0.28, sfx: 0.72, muted: false, shake: true, reducedEffects: false, tutorialHints: true };
export const defaultRecords: Records = { bestScore: 0, fastestWin: null, highestLevel: 1, mostKills: 0, runs: 0, victories: 0 };
export const defaultTutorialProgress: TutorialProgress = { completed: {} };

export class StorageManager {
  settings: Settings = { ...defaultSettings };
  records: Records = { ...defaultRecords };
  tutorials: TutorialProgress = { completed: {} };

  constructor() { this.load(); }

  load(): void {
    try {
      const current = localStorage.getItem(KEY);
      const raw = current ?? localStorage.getItem(LEGACY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { settings?: Partial<Settings>; records?: Partial<Records>; tutorials?: Partial<TutorialProgress> };
      this.settings = this.sanitizeSettings({ ...defaultSettings, ...parsed.settings });
      this.records = this.sanitizeRecords({ ...defaultRecords, ...parsed.records });
      this.tutorials = this.sanitizeTutorials(parsed.tutorials);
      if (!current && this.records.runs > 0) {
        this.tutorials.completed = { ...this.tutorials.completed, move: true, attack: true, dash: true };
      }
      if (!current) this.save();
    } catch { this.settings = { ...defaultSettings }; this.records = { ...defaultRecords }; this.tutorials = { completed: {} }; }
  }

  save(): void {
    try { localStorage.setItem(KEY, JSON.stringify({ version: 3, settings: this.settings, records: this.records, tutorials: this.tutorials })); } catch { /* Private mode may deny writes. */ }
  }

  isTutorialComplete(id: TutorialId): boolean { return this.tutorials.completed[id] === true; }
  completeTutorial(id: TutorialId): void { if (this.isTutorialComplete(id)) return; this.tutorials.completed[id] = true; this.save(); }
  resetTutorials(): void { this.tutorials = { completed: {} }; this.save(); }

  private sanitizeSettings(value: Settings): Settings {
    const volume = (n: unknown, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
    return {
      master: volume(value.master, defaultSettings.master), music: volume(value.music, defaultSettings.music),
      sfx: volume(value.sfx, defaultSettings.sfx), muted: typeof value.muted === 'boolean' ? value.muted : false,
      shake: typeof value.shake === 'boolean' ? value.shake : true,
      reducedEffects: typeof value.reducedEffects === 'boolean' ? value.reducedEffects : false,
      tutorialHints: typeof value.tutorialHints === 'boolean' ? value.tutorialHints : true
    };
  }

  private sanitizeRecords(value: Records): Records {
    const count = (n: unknown, fallback: number) => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : fallback;
    return {
      bestScore: count(value.bestScore, 0), fastestWin: value.fastestWin === null ? null : count(value.fastestWin, 0),
      highestLevel: count(value.highestLevel, 1), mostKills: count(value.mostKills, 0), runs: count(value.runs, 0),
      victories: count(value.victories, 0)
    };
  }

  private sanitizeTutorials(value?: Partial<TutorialProgress>): TutorialProgress {
    const source = value?.completed && typeof value.completed === 'object' ? value.completed : {};
    const completed: Partial<Record<TutorialId, true>> = {};
    for (const id of TUTORIAL_IDS) if (source[id] === true) completed[id] = true;
    return { completed };
  }
}
