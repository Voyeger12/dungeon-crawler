import type { Records, Settings } from './model';

const KEY = 'rune-deep-save-v2';
export const defaultSettings: Settings = { master: 0.8, music: 0.28, sfx: 0.72, muted: false, shake: true, reducedEffects: false };
export const defaultRecords: Records = { bestScore: 0, fastestWin: null, highestLevel: 1, mostKills: 0, runs: 0, victories: 0 };

export class StorageManager {
  settings: Settings = { ...defaultSettings };
  records: Records = { ...defaultRecords };

  constructor() { this.load(); }

  load(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { settings?: Partial<Settings>; records?: Partial<Records> };
      this.settings = this.sanitizeSettings({ ...defaultSettings, ...parsed.settings });
      this.records = this.sanitizeRecords({ ...defaultRecords, ...parsed.records });
    } catch { this.settings = { ...defaultSettings }; this.records = { ...defaultRecords }; }
  }

  save(): void {
    try { localStorage.setItem(KEY, JSON.stringify({ version: 2, settings: this.settings, records: this.records })); } catch { /* Private mode may deny writes. */ }
  }

  private sanitizeSettings(value: Settings): Settings {
    const volume = (n: unknown, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
    return {
      master: volume(value.master, defaultSettings.master), music: volume(value.music, defaultSettings.music),
      sfx: volume(value.sfx, defaultSettings.sfx), muted: typeof value.muted === 'boolean' ? value.muted : false,
      shake: typeof value.shake === 'boolean' ? value.shake : true,
      reducedEffects: typeof value.reducedEffects === 'boolean' ? value.reducedEffects : false
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
}
