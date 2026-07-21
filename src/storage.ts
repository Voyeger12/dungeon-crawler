import type { DisplayMode, Records, RenderPreset, Settings, TutorialId, TutorialProgress, UiScale } from './model';

const KEY = 'rune-deep-save-v4';
const LEGACY_V3_KEY = 'rune-deep-save-v3';
const LEGACY_V2_KEY = 'rune-deep-save-v2';
const TUTORIAL_IDS: TutorialId[] = ['move', 'attack', 'dash', 'potion', 'interact', 'character', 'map', 'gold', 'key'];
const DISPLAY_MODES: DisplayMode[] = ['fit', 'fullscreen'];
const RENDER_PRESETS: RenderPreset[] = ['auto', '720p', '900p', '1080p', '1440p'];
const UI_SCALES: UiScale[] = [90, 100, 110, 125];
export const defaultSettings: Settings = {
  master: 0.8, music: 0.28, sfx: 0.72, muted: false, shake: true, reducedEffects: false, tutorialHints: true,
  displayMode: 'fit', renderPreset: 'auto', uiScale: 100
};
export const defaultRecords: Records = { bestScore: 0, fastestWin: null, highestLevel: 1, mostKills: 0, runs: 0, victories: 0 };
export const defaultTutorialProgress: TutorialProgress = { completed: {} };

export class StorageManager {
  settings: Settings = { ...defaultSettings };
  records: Records = { ...defaultRecords };
  tutorials: TutorialProgress = { completed: {} };

  constructor() { this.load(); }

  load(): void {
    try {
      const candidates = [KEY, LEGACY_V3_KEY, LEGACY_V2_KEY] as const;
      let source: typeof candidates[number] | undefined;
      let parsed: { settings?: Partial<Settings>; records?: Partial<Records>; tutorials?: Partial<TutorialProgress> } | undefined;
      for (const candidate of candidates) {
        const raw = localStorage.getItem(candidate); if (!raw) continue;
        try {
          const value = JSON.parse(raw) as unknown;
          if (!value || typeof value !== 'object') continue;
          source = candidate; parsed = value as typeof parsed; break;
        } catch { /* Fall through to the next recoverable save generation. */ }
      }
      if (!source || !parsed) return;
      this.settings = this.sanitizeSettings(parsed.settings);
      this.records = this.sanitizeRecords({ ...defaultRecords, ...parsed.records });
      this.tutorials = this.sanitizeTutorials(parsed.tutorials);
      if (source === LEGACY_V2_KEY && this.records.runs > 0) {
        this.tutorials.completed = { ...this.tutorials.completed, move: true, attack: true, dash: true };
      }
      if (source !== KEY) this.save();
    } catch { this.settings = { ...defaultSettings }; this.records = { ...defaultRecords }; this.tutorials = { completed: {} }; }
  }

  save(): void {
    try { localStorage.setItem(KEY, JSON.stringify({ version: 4, settings: this.settings, records: this.records, tutorials: this.tutorials })); } catch { /* Private mode may deny writes. */ }
  }

  isTutorialComplete(id: TutorialId): boolean { return this.tutorials.completed[id] === true; }
  completeTutorial(id: TutorialId): void { if (this.isTutorialComplete(id)) return; this.tutorials.completed[id] = true; this.save(); }
  resetTutorials(): void { this.tutorials = { completed: {} }; this.save(); }

  private sanitizeSettings(value: unknown): Settings {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<Settings> : {};
    const volume = (n: unknown, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
    const choice = <T extends string | number>(candidate: unknown, allowed: readonly T[], fallback: T): T => allowed.includes(candidate as T) ? candidate as T : fallback;
    return {
      master: volume(source.master, defaultSettings.master), music: volume(source.music, defaultSettings.music),
      sfx: volume(source.sfx, defaultSettings.sfx), muted: typeof source.muted === 'boolean' ? source.muted : false,
      shake: typeof source.shake === 'boolean' ? source.shake : true,
      reducedEffects: typeof source.reducedEffects === 'boolean' ? source.reducedEffects : false,
      tutorialHints: typeof source.tutorialHints === 'boolean' ? source.tutorialHints : true,
      displayMode: choice(source.displayMode, DISPLAY_MODES, defaultSettings.displayMode),
      renderPreset: choice(source.renderPreset, RENDER_PRESETS, defaultSettings.renderPreset),
      uiScale: choice(source.uiScale, UI_SCALES, defaultSettings.uiScale)
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
