import { WORLD } from './config';
import type { DisplayMode, RenderPreset, Settings, UiScale } from './model';

export const DISPLAY_MODE_REQUEST_EVENT = 'rune-display-mode-request';
export const DISPLAY_STATE_EVENT = 'rune-display-state';
export const MAX_BACKBUFFER = { width: 3840, height: 2160 } as const;
export const MIN_BACKBUFFER = { width: 480, height: 270 } as const;

const RENDER_PRESET_SIZE: Record<Exclude<RenderPreset, 'auto'>, { width: number; height: number }> = {
  '720p': { width: 1280, height: 720 },
  '900p': { width: 1600, height: 900 },
  '1080p': { width: 1920, height: 1080 },
  '1440p': { width: 2560, height: 1440 }
};
const DISPLAY_MODES: readonly DisplayMode[] = ['fit', 'fullscreen'];
const RENDER_PRESETS: readonly RenderPreset[] = ['auto', '720p', '900p', '1080p', '1440p'];
const UI_SCALES: readonly UiScale[] = [90, 100, 110, 125];

export interface BackbufferSize { width: number; height: number; scale: number }
export interface DisplayState extends BackbufferSize {
  displayMode: DisplayMode; renderPreset: RenderPreset; uiScale: UiScale; fullscreen: boolean; devicePixelRatio: number;
}

export interface DisplayManagerOptions {
  root?: HTMLElement;
  frame?: HTMLElement;
  onSettingsChange?: () => void;
  getDevicePixelRatio?: () => number;
}

export function isDisplayMode(value: unknown): value is DisplayMode { return DISPLAY_MODES.includes(value as DisplayMode); }
export function isRenderPreset(value: unknown): value is RenderPreset { return RENDER_PRESETS.includes(value as RenderPreset); }
export function isUiScale(value: unknown): value is UiScale { return UI_SCALES.includes(value as UiScale); }

export function resolveBackbufferSize(cssWidth: number, cssHeight: number, devicePixelRatio: number, preset: RenderPreset): BackbufferSize {
  if (preset !== 'auto') {
    const fixed = RENDER_PRESET_SIZE[preset];
    return { ...fixed, scale: fixed.width / WORLD.width };
  }
  const width = Number.isFinite(cssWidth) ? Math.max(0, cssWidth) : 0;
  const height = Number.isFinite(cssHeight) ? Math.max(0, cssHeight) : 0;
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const measuredScale = width > 0 && height > 0 ? Math.min(width * dpr / WORLD.width, height * dpr / WORLD.height) : 1;
  const scale = Math.max(MIN_BACKBUFFER.width / WORLD.width, Math.min(MAX_BACKBUFFER.width / WORLD.width, measuredScale));
  return { width: Math.round(WORLD.width * scale), height: Math.round(WORLD.height * scale), scale };
}

export class DisplayManager {
  private readonly root: HTMLElement;
  private readonly frame: HTMLElement;
  private readonly onSettingsChange?: () => void;
  private readonly getDevicePixelRatio: () => number;
  private settings: Settings;
  private resizeObserver?: ResizeObserver;
  private dprQuery?: MediaQueryList;
  private lastState?: DisplayState;

  constructor(private canvas: HTMLCanvasElement, settings: Settings, options: DisplayManagerOptions = {}) {
    this.settings = settings;
    this.root = options.root ?? canvas.closest<HTMLElement>('#app') ?? document.documentElement;
    this.frame = options.frame ?? canvas.parentElement ?? canvas;
    this.onSettingsChange = options.onSettingsChange;
    this.getDevicePixelRatio = options.getDevicePixelRatio ?? (() => window.devicePixelRatio || 1);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.frame);
    }
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    this.bindDprQuery();
    this.applySettings(settings);
    this.handleFullscreenChange();
  }

  get state(): DisplayState {
    if (!this.lastState) this.refresh();
    return this.lastState!;
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
    const renderPreset = isRenderPreset(settings.renderPreset) ? settings.renderPreset : 'auto';
    const uiScale = isUiScale(settings.uiScale) ? settings.uiScale : 100;
    const displayMode = isDisplayMode(settings.displayMode) ? settings.displayMode : 'fit';
    this.root.dataset.displayMode = displayMode;
    this.root.dataset.renderPreset = renderPreset;
    this.root.dataset.uiScale = String(uiScale);
    this.root.style.setProperty('--ui-scale', String(uiScale / 100));
    this.root.style.setProperty('--ui-scale-percent', `${uiScale}%`);
    if (document.documentElement !== this.root) {
      document.documentElement.style.setProperty('--ui-scale', String(uiScale / 100));
      document.documentElement.style.setProperty('--ui-scale-percent', `${uiScale}%`);
    }
    this.refresh();
  }

  refresh(): void {
    const rect = this.frame.getBoundingClientRect();
    const preset = isRenderPreset(this.settings.renderPreset) ? this.settings.renderPreset : 'auto';
    const dpr = this.safeDevicePixelRatio();
    if (preset === 'auto' && (rect.width <= 0 || rect.height <= 0)) {
      this.publishState(this.canvas.width, this.canvas.height, this.canvas.width / WORLD.width, dpr);
      return;
    }
    const size = resolveBackbufferSize(rect.width, rect.height, dpr, preset);
    if (this.canvas.width !== size.width) this.canvas.width = size.width;
    if (this.canvas.height !== size.height) this.canvas.height = size.height;
    this.publishState(size.width, size.height, size.scale, dpr);
  }

  async setDisplayMode(mode: DisplayMode): Promise<boolean> {
    if (!isDisplayMode(mode)) return false;
    this.setStoredDisplayMode(mode);
    if (mode === 'fullscreen') {
      if (document.fullscreenElement === this.root) return true;
      if (!this.root.requestFullscreen) { this.setStoredDisplayMode('fit'); this.refresh(); return false; }
      try { await this.root.requestFullscreen(); }
      catch { this.setStoredDisplayMode('fit'); this.updateFullscreenMetadata(); this.refresh(); return false; }
      this.handleFullscreenChange();
      return document.fullscreenElement === this.root;
    }
    if (document.fullscreenElement === this.root && document.exitFullscreen) {
      try { await document.exitFullscreen(); }
      catch { this.updateFullscreenMetadata(); this.refresh(); return false; }
    }
    this.handleFullscreenChange();
    return document.fullscreenElement !== this.root;
  }

  toggleFullscreen(): Promise<boolean> {
    return this.setDisplayMode(document.fullscreenElement === this.root ? 'fit' : 'fullscreen');
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    this.dprQuery?.removeEventListener('change', this.handleDprChange);
  }

  private handleResize = (): void => { this.refresh(); };

  private handleDprChange = (): void => {
    this.bindDprQuery();
    this.refresh();
  };

  private handleFullscreenChange = (): void => {
    const fullscreen = document.fullscreenElement === this.root;
    if (fullscreen && this.settings.displayMode !== 'fullscreen') this.setStoredDisplayMode('fullscreen');
    else if (!fullscreen && this.settings.displayMode === 'fullscreen') this.setStoredDisplayMode('fit');
    this.updateFullscreenMetadata();
    this.refresh();
  };

  private bindDprQuery(): void {
    this.dprQuery?.removeEventListener('change', this.handleDprChange);
    if (!window.matchMedia) { this.dprQuery = undefined; return; }
    this.dprQuery = window.matchMedia(`(resolution: ${this.safeDevicePixelRatio()}dppx)`);
    this.dprQuery.addEventListener('change', this.handleDprChange, { once: true });
  }

  private safeDevicePixelRatio(): number {
    const value = this.getDevicePixelRatio();
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  private setStoredDisplayMode(mode: DisplayMode): void {
    if (this.settings.displayMode === mode) return;
    this.settings.displayMode = mode;
    this.root.dataset.displayMode = mode;
    this.onSettingsChange?.();
  }

  private updateFullscreenMetadata(): void {
    this.root.dataset.fullscreen = String(document.fullscreenElement === this.root);
  }

  private publishState(width: number, height: number, scale: number, devicePixelRatio: number): void {
    const renderPreset = isRenderPreset(this.settings.renderPreset) ? this.settings.renderPreset : 'auto';
    const uiScale = isUiScale(this.settings.uiScale) ? this.settings.uiScale : 100;
    const displayMode = isDisplayMode(this.settings.displayMode) ? this.settings.displayMode : 'fit';
    this.lastState = { width, height, scale, devicePixelRatio, renderPreset, uiScale, displayMode, fullscreen: document.fullscreenElement === this.root };
    this.canvas.dataset.renderWidth = String(width);
    this.canvas.dataset.renderHeight = String(height);
    this.canvas.dataset.renderScale = scale.toFixed(4);
    this.root.style.setProperty('--render-scale', scale.toFixed(4));
    this.root.style.setProperty('--render-width', `${width}px`);
    this.root.style.setProperty('--render-height', `${height}px`);
    if (typeof CustomEvent !== 'undefined') this.root.dispatchEvent(new CustomEvent<DisplayState>(DISPLAY_STATE_EVENT, { detail: this.lastState }));
  }
}
