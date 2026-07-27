import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });

const stats = {
  startTime: 0, elapsed: 754, kills: 37, goldFound: 143, roomsVisited: 11,
  potionsUsed: 3, damageDealt: 1940, damageTaken: 218
};
const player = {
  hp: -4, level: 6, relics: ['storm-rune', 'blood-blade']
};

try {
  const { UI } = await server.ssrLoadModule('/src/ui.ts');

  const render = victory => {
    let focused = 0; const listeners = [];
    const button = {
      addEventListener: (type, callback) => listeners.push([type, callback]),
      focus: () => { focused++; }
    };
    const ui = Object.create(UI.prototype);
    ui.root = {
      innerHTML: '',
      querySelector: () => button
    };
    ui.hudView = { hideTransient() {}, hide() {} };
    ui.setGameInert = () => {};
    ui.actions = { restart() {}, mainMenu() {} };
    ui.showEnd(victory, stats, player);
    return { html: ui.root.innerHTML, focused, listeners };
  };

  const victory = render(true);
  assert.match(victory.html, /data-outcome="victory"/);
  assert.match(victory.html, /role="dialog"/);
  assert.match(victory.html, /Runenwächter bezwungen/);
  assert.match(victory.html, /ERSTE TIEFE · BEZWUNGEN/);
  assert.match(victory.html, /Neue Expedition/);
  assert.match(victory.html, /vfx-boss-rune\.png/);
  assert.equal((victory.html.match(/<dt>/g) ?? []).length, 8, 'the run chronicle must expose all eight result values');
  assert.equal((victory.html.match(/class="primary"/g) ?? []).length, 1, 'the primary action must be visually unambiguous');
  assert.equal(victory.focused, 1, 'the replay action must receive keyboard focus');
  assert.equal(victory.listeners.length, 2, 'both end-screen actions must remain interactive');
  assert.doesNotMatch(victory.html, /end-sigil|☠|✦/, 'the old generic glyph end screen must not return');

  const defeat = render(false);
  assert.match(defeat.html, /data-outcome="defeat"/);
  assert.match(defeat.html, /Die Runen erlöschen/);
  assert.match(defeat.html, /EXPEDITION · BEENDET/);
  assert.match(defeat.html, /Erneut hinabsteigen/);
  assert.match(defeat.html, /vfx-crit\.png/);
  assert.match(defeat.html, />0<\/dd>/, 'remaining life must never be presented as a negative value');

  for (const path of [
    '/assets/gameplay/generated/collectables/pickup-gold.png',
    '/assets/gameplay/generated/collectables/pickup-relic.png',
    '/assets/gameplay/generated/collectables/pickup-potion.png',
    '/assets/gameplay/generated/vfx/vfx-slash.png'
  ]) assert.equal(victory.html.includes(path), true, `${path} must be used by the result presentation`);

  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.end-screen\.victory \.end-figure\s*\{\s*background-image: url\('\/assets\/characters\/generated\/clean\/boss-atlas\.png'\)/);
  assert.match(css, /\.end-screen\.defeat \.end-figure\s*\{\s*background-image: url\('\/assets\/characters\/generated\/clean\/runebearer-atlas\.png'\)/);
  assert.match(css, /dark-oak\.webp/);
  assert.match(css, /oxblood-leather\.webp/);
  assert.match(css, /@media \(max-width: 650px\)/);

  console.log('Asset-led victory and defeat chronicle tests passed.');
} finally {
  await server.close();
}
