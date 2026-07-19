import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });

try {
  const { DISPLAY_STATE_EVENT, DisplayManager, MAX_BACKBUFFER, resolveBackbufferSize } = await server.ssrLoadModule('/src/display.ts');
  const { InputManager } = await server.ssrLoadModule('/src/input.ts');
  const { configureLogicalCanvasContext } = await server.ssrLoadModule('/src/renderer.ts');
  const { StorageManager, defaultSettings } = await server.ssrLoadModule('/src/storage.ts');

  assert.deepEqual(resolveBackbufferSize(960, 540, 1, 'auto'), { width: 960, height: 540, scale: 1 });
  assert.deepEqual(resolveBackbufferSize(960, 540, 2, 'auto'), { width: 1920, height: 1080, scale: 2 });
  assert.deepEqual(resolveBackbufferSize(480, 270, 1, 'auto'), { width: 480, height: 270, scale: .5 });
  assert.deepEqual(resolveBackbufferSize(960, 540, 1, '1080p'), { width: 1920, height: 1080, scale: 2 });
  assert.deepEqual(resolveBackbufferSize(8000, 4500, 2, 'auto'), { ...MAX_BACKBUFFER, scale: 4 }, 'automatic rendering must respect the 4K backbuffer cap');

  const transformCalls = [];
  const context = { imageSmoothingEnabled: true, setTransform: (...args) => transformCalls.push(args) };
  configureLogicalCanvasContext(context, { width: 1920, height: 1080 });
  assert.deepEqual(transformCalls.at(-1), [2, 0, 0, 2, 0, 0], 'the renderer must preserve the logical 960x540 coordinate system');
  assert.equal(context.imageSmoothingEnabled, false, 'backbuffer changes must restore the intended smoothing state');

  class FakeStyle {
    values = new Map();
    setProperty(name, value) { this.values.set(name, value); }
    getPropertyValue(name) { return this.values.get(name) ?? ''; }
  }
  class FakeElement extends EventTarget {
    dataset = {};
    style = new FakeStyle();
    parentElement = null;
    rect = { left: 40, top: 20, width: 960, height: 540 };
    getBoundingClientRect() { return this.rect; }
  }
  class FakeCanvas extends FakeElement {
    width = 960;
    height = 540;
    closest() { return null; }
  }
  class FakeResizeObserver {
    static current;
    constructor(callback) { this.callback = callback; FakeResizeObserver.current = this; }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
    trigger() { this.callback([{ target: this.target }]); }
  }

  const fakeWindow = new EventTarget();
  fakeWindow.devicePixelRatio = 2;
  fakeWindow.matchMedia = () => ({ addEventListener() {}, removeEventListener() {} });
  const fakeDocument = new EventTarget();
  const root = new FakeElement();
  const htmlRoot = new FakeElement();
  const frame = new FakeElement();
  const canvas = new FakeCanvas();
  fakeDocument.documentElement = htmlRoot;
  fakeDocument.fullscreenElement = null;
  fakeDocument.exitFullscreen = async () => {
    fakeDocument.fullscreenElement = null;
    fakeDocument.dispatchEvent(new Event('fullscreenchange'));
  };
  root.requestFullscreen = async () => {
    fakeDocument.fullscreenElement = root;
    fakeDocument.dispatchEvent(new Event('fullscreenchange'));
  };
  globalThis.window = fakeWindow;
  globalThis.document = fakeDocument;
  globalThis.ResizeObserver = FakeResizeObserver;

  let settingsChanges = 0;
  const settings = { ...defaultSettings };
  let stateEvents = 0;
  root.addEventListener(DISPLAY_STATE_EVENT, () => { stateEvents++; });
  const display = new DisplayManager(canvas, settings, { root, frame, onSettingsChange: () => { settingsChanges++; }, getDevicePixelRatio: () => 2 });
  assert.equal(canvas.width, 1920);
  assert.equal(canvas.height, 1080);
  assert.equal(root.style.getPropertyValue('--ui-scale'), '1');
  assert.equal(htmlRoot.style.getPropertyValue('--ui-scale'), '1', 'rem-based overlays must receive the same UI scale as the app');
  assert.ok(stateEvents > 0, 'display state changes must be observable by the UI');

  settings.renderPreset = '1440p'; settings.uiScale = 125;
  display.applySettings(settings);
  assert.equal(canvas.width, 2560);
  assert.equal(canvas.height, 1440);
  assert.equal(root.dataset.renderPreset, '1440p');
  assert.equal(root.style.getPropertyValue('--ui-scale'), '1.25');
  assert.equal(htmlRoot.style.getPropertyValue('--ui-scale'), '1.25');

  assert.equal(await display.setDisplayMode('fullscreen'), true);
  assert.equal(settings.displayMode, 'fullscreen');
  assert.equal(root.dataset.fullscreen, 'true');
  assert.equal(await display.setDisplayMode('fit'), true);
  assert.equal(settings.displayMode, 'fit');
  assert.equal(root.dataset.fullscreen, 'false');
  assert.ok(settingsChanges >= 2, 'fullscreen transitions must be persisted through the settings callback');

  frame.rect = { left: 0, top: 0, width: 640, height: 360 };
  settings.renderPreset = 'auto'; display.applySettings(settings); FakeResizeObserver.current.trigger();
  assert.equal(canvas.width, 1280);
  assert.equal(canvas.height, 720);
  canvas.rect = { left: 40, top: 20, width: 640, height: 360 };
  canvas.closest = () => root;
  const input = new InputManager(canvas, () => {}, () => true);
  input.onPointerMove({ clientX: 360, clientY: 200 });
  assert.deepEqual(input.mouse, { x: 480, y: 270, down: false, pressed: false }, 'backbuffer scaling must not change logical pointer coordinates');
  canvas.rect = { left: 200, top: 100, width: 640, height: 360 };
  root.dispatchEvent(new CustomEvent(DISPLAY_STATE_EVENT, { detail: display.state }));
  assert.deepEqual(input.mouse, { x: 240, y: 150, down: false, pressed: false }, 'display changes must reproject the stationary pointer immediately');
  display.destroy();
  assert.equal(FakeResizeObserver.current.disconnected, true);

  const memory = new Map();
  globalThis.localStorage = {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: key => memory.delete(key),
    clear: () => memory.clear()
  };
  memory.set('rune-deep-save-v3', JSON.stringify({
    version: 3,
    settings: { master: .4, renderPreset: 'invalid', uiScale: 137, displayMode: 'exclusive' },
    records: { runs: 3, bestScore: 1200 },
    tutorials: { completed: { move: true } }
  }));
  const migrated = new StorageManager();
  assert.equal(migrated.settings.master, .4);
  assert.equal(migrated.settings.renderPreset, 'auto');
  assert.equal(migrated.settings.uiScale, 100);
  assert.equal(migrated.settings.displayMode, 'fit');
  assert.equal(migrated.records.bestScore, 1200);
  assert.equal(migrated.isTutorialComplete('move'), true);
  assert.equal(JSON.parse(memory.get('rune-deep-save-v4')).version, 4, 'v3 saves must be rewritten as validated v4 saves');

  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /font-size:\s*calc\(16px \* var\(--ui-scale/, 'the root rem scale must follow the UI setting');
  assert.match(css, /max-width:\s*1399px/, 'the compact surround must protect intermediate-width windows');
  assert.match(css, /--board-chrome:/, 'compact layouts must reserve scaled space for their HUD rows');

  console.log('Display, scaling, fullscreen, and save migration tests passed.');
} finally {
  await server.close();
}
