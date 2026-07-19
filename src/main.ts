import './style.css';
import { DISPLAY_MODE_REQUEST_EVENT, DisplayManager, isDisplayMode } from './display';
import { Game } from './game';
import { StorageManager } from './storage';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Canvas konnte nicht initialisiert werden.');
const app = document.querySelector<HTMLElement>('#app');
const frame = document.querySelector<HTMLElement>('#game-frame');
if (!app || !frame) throw new Error('Spielanzeige konnte nicht initialisiert werden.');

const store = new StorageManager();
const display = new DisplayManager(canvas, store.settings, { root: app, frame, onSettingsChange: () => store.save() });
window.addEventListener('rune-settings', () => display.applySettings(store.settings));
window.addEventListener(DISPLAY_MODE_REQUEST_EVENT, event => {
  const detail = (event as CustomEvent<{ mode?: unknown } | unknown>).detail;
  const mode = typeof detail === 'object' && detail !== null && 'mode' in detail ? detail.mode : detail;
  if (isDisplayMode(mode)) void display.setDisplayMode(mode);
});

new Game(canvas, store);
