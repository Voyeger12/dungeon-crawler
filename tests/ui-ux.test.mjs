import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });

try {
  const { StorageManager, defaultSettings } = await server.ssrLoadModule('/src/storage.ts');
  const { TutorialController } = await server.ssrLoadModule('/src/tutorial.ts');
  const { InputManager } = await server.ssrLoadModule('/src/input.ts');
  const { generateDungeon } = await server.ssrLoadModule('/src/dungeon.ts');
  const { HudView } = await server.ssrLoadModule('/src/hud.ts');
  const { Game } = await server.ssrLoadModule('/src/game.ts');
  const { XP_FOR_LEVEL } = await server.ssrLoadModule('/src/config.ts');

  const memory = new Map();
  globalThis.localStorage = {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: key => memory.delete(key),
    clear: () => memory.clear()
  };

  memory.set('rune-deep-save-v2', JSON.stringify({
    version: 2,
    settings: { master: 4, music: -2, muted: true },
    records: { runs: 2, bestScore: 900 }
  }));
  const migrated = new StorageManager();
  assert.equal(migrated.settings.master, 1, 'volume migration must clamp values');
  assert.equal(migrated.settings.music, 0, 'negative legacy volume must clamp to zero');
  assert.equal(migrated.settings.tutorialHints, true, 'new tutorial setting must default to enabled');
  assert.equal(migrated.records.bestScore, 900, 'legacy records must survive migration');
  assert.equal(migrated.isTutorialComplete('move'), true, 'experienced legacy profiles should skip basic movement help');
  migrated.resetTutorials();
  assert.equal(migrated.isTutorialComplete('move'), false, 'tutorial reset must clear persisted completion');
  migrated.completeTutorial('move');
  assert.equal(JSON.parse(memory.get('rune-deep-save-v4')).version, 4, 'tutorial progress must persist in save version 4');
  assert.equal(migrated.settings.displayMode, 'fit', 'legacy saves must receive the safe browser-fit display mode');
  assert.equal(migrated.settings.renderPreset, 'auto', 'legacy saves must receive automatic render sizing');
  assert.equal(migrated.settings.uiScale, 100, 'legacy saves must receive the standard UI scale');

  const completed = new Set();
  const tutorialStore = {
    isTutorialComplete: id => completed.has(id),
    completeTutorial: id => completed.add(id)
  };
  const tutorial = new TutorialController(tutorialStore);
  const safe = { enabled: true, overlay: false, boss: false, combat: false, safe: true, interactable: false, potionNeeded: false };
  tutorial.beginRun();
  assert.equal(tutorial.update(.1, safe)?.id, 'move', 'a new run should begin with movement guidance');
  tutorial.trackMovement(.36, true);
  assert.equal(tutorial.update(.1, safe)?.id, 'attack', 'movement completion should unlock attack guidance');
  tutorial.complete('attack');
  assert.equal(tutorial.update(.1, { ...safe, boss: true }), undefined, 'boss encounters must suppress tutorials');
  assert.equal(tutorial.update(.1, safe)?.id, 'dash', 'suppressed tutorials should resume safely');
  tutorial.complete('dash');
  tutorial.queue('gold');
  assert.equal(tutorial.update(.1, { ...safe, overlay: true }), undefined, 'modal overlays must suppress tutorials');
  assert.equal(tutorial.update(.1, safe)?.id, 'gold', 'informational hints should appear in safe rooms');
  assert.equal(tutorial.update(3.2, safe), undefined, 'informational hints should dismiss themselves');
  assert.equal(completed.has('gold'), true, 'auto-dismissed info must persist completion');
  tutorial.queue('interact');
  assert.equal(tutorial.update(.1, { ...safe, interactable: true })?.id, 'interact', 'interaction help should require a usable nearby target');
  assert.equal(tutorial.update(.1, safe), undefined, 'leaving interaction range should hide the stale prompt');
  tutorial.queue('key');
  assert.equal(tutorial.update(.1, safe)?.id, 'key', 'an invalidated context hint must not block later eligible guidance');

  const urgentCompleted = new Set();
  const urgent = new TutorialController({ isTutorialComplete: id => urgentCompleted.has(id), completeTutorial: id => urgentCompleted.add(id) });
  urgent.beginRun();
  assert.equal(urgent.update(.1, safe)?.id, 'move');
  urgent.queue('potion');
  assert.equal(urgent.update(.1, { ...safe, potionNeeded: true })?.id, 'potion', 'an urgent potion hint must preempt non-critical onboarding');
  urgent.suspendUntilNextRun();
  assert.equal(urgent.update(.1, { ...safe, potionNeeded: true }), undefined, 'tutorial reset must suspend hints until the next run');

  for (let run = 0; run < 30; run++) {
    const rooms = generateDungeon();
    assert.equal(rooms.has('start'), true, 'every generated dungeon needs a start room');
    const boss = [...rooms.values()].find(room => room.kind === 'boss');
    assert.ok(boss, 'every generated dungeon needs a boss room');
    const visited = new Set(['start']); const queue = ['start'];
    while (queue.length) for (const id of Object.values(rooms.get(queue.shift()).connections)) if (id && !visited.has(id)) { visited.add(id); queue.push(id); }
    assert.equal(visited.has(boss.id), true, 'the boss must be reachable from the start');
    for (const room of rooms.values()) for (const id of Object.values(room.connections)) assert.equal(rooms.has(id), true, 'all generated exits must resolve to rooms');
  }

  class FakeClassList {
    constructor(owner) { this.owner = owner; this.values = new Set(); }
    add(value) { if (!this.values.has(value)) { this.values.add(value); this.owner.mutations++; } }
    remove(value) { if (this.values.delete(value)) this.owner.mutations++; }
    toggle(value, force) { const next = force === undefined ? !this.values.has(value) : force; next ? this.add(value) : this.remove(value); return next; }
    contains(value) { return this.values.has(value); }
  }
  class FakeStyle {
    constructor(owner) { this.owner = owner; this.values = new Map(); }
    getPropertyValue(key) { return this.values.get(key) ?? ''; }
    setProperty(key, value) { if (this.values.get(key) !== value) { this.values.set(key, value); this.owner.mutations++; } }
  }
  class FakeElement {
    constructor() {
      this.mutations = 0; this._text = ''; this.attributes = new Map(); this.children = [];
      this.classList = new FakeClassList(this); this.style = new FakeStyle(this);
      const values = {}; this.dataset = new Proxy(values, { set: (target, key, value) => { if (target[key] !== value) { target[key] = value; this.mutations++; } return true; } });
    }
    get textContent() { return this._text; }
    set textContent(value) { if (this._text !== value) { this._text = value; this.mutations++; } }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    setAttribute(name, value) { if (this.attributes.get(name) !== value) { this.attributes.set(name, value); this.mutations++; } }
    append(...children) { this.children.push(...children); this.mutations++; }
    replaceChildren(...children) { this.children = children; this.mutations++; }
  }
  const hudSelectors = ['#hud','#level-value','#health-bar','#health-fill','#health-text','#xp-bar','#xp-fill','#xp-text','#room-title','#objective','#gold-value','#key-resource','#key-value','#potion-action','#potion-count','#potion-state','#dash-indicator','#dash-fill','#dash-state','#minimap-content','#effects','#tutorial-hint','#tutorial-key','#tutorial-title','#tutorial-text','#context-prompt','#context-key','#context-text','#boss-hud','#boss-bar','#boss-fill','#boss-name','#boss-text','#game-status-region','#game-alert-region'];
  const hudElements = new Map(hudSelectors.map(selector => [selector, new FakeElement()]));
  globalThis.document = { querySelector: selector => hudElements.get(selector) ?? null, createElement: () => new FakeElement() };
  globalThis.window = { setTimeout: callback => { callback(); return 1; } };
  const hud = new HudView();
  const hudState = { hp: 100, maxHp: 120, xp: 10, xpNeeded: 92, level: 1, gold: 7, keys: 0, showKeys: false, potions: 2, potionHeal: 42, dashRemaining: 0, dashCooldown: 2.4, roomName: 'Start', objective: 'Erkunden', combat: false, effects: [] };
  hud.update(hudState);
  hudElements.forEach(element => { element.mutations = 0; });
  hud.update({ ...hudState, effects: [] });
  assert.equal([...hudElements.values()].reduce((sum, element) => sum + element.mutations, 0), 0, 'an identical HUD state must produce zero DOM mutations');
  hud.update({ ...hudState, dashRemaining: 1.2, effects: [] });
  assert.equal(hudElements.get('#dash-fill').mutations > 0, true, 'a cooldown change should update the cached dash meter');

  const fakeWindow = new EventTarget();
  globalThis.window = fakeWindow;
  const canvas = new EventTarget();
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 540 });
  let active = true;
  const input = new InputManager(canvas, () => {}, () => active);
  const key = (code, overrides = {}) => {
    let prevented = false;
    const event = { code, target: null, ctrlKey: false, altKey: false, metaKey: false, preventDefault: () => { prevented = true; }, ...overrides };
    input.onKeyDown(event);
    return () => prevented;
  };
  const arrowPrevented = key('ArrowUp');
  assert.equal(arrowPrevented(), true, 'gameplay arrows must not scroll the page');
  assert.equal(input.isDown('ArrowUp'), true, 'unmodified gameplay input must be tracked');
  input.reset(); active = false;
  const inactivePrevented = key('Space');
  assert.equal(inactivePrevented(), false, 'space must remain available to focused overlay controls');
  input.reset();
  assert.equal(input.isNeutral('Space', 'Digit1', 'Digit2', 'Digit3'), false, 'reset must not disguise a physically held attack key as neutral');
  input.onKeyUp({ code: 'Space' });
  assert.equal(input.isNeutral('Space', 'Digit1', 'Digit2', 'Digit3'), true, 'the level-up gate should arm after the held key is released');
  input.onGlobalPointerDown({ button: 0 }); input.reset();
  assert.equal(input.isNeutral('Space', 'Digit1', 'Digit2', 'Digit3'), false, 'a held primary pointer anywhere in the overlay must keep choices locked');
  input.onPointerUp({ button: 0 });
  assert.equal(input.isNeutral('Space', 'Digit1', 'Digit2', 'Digit3'), true, 'releasing the pointer should arm choices without carrying a click');
  key('Digit1'); assert.equal(input.consume('Digit1'), true, 'a fresh number-key press should be consumable once');
  key('Digit1'); assert.equal(input.consume('Digit1'), false, 'key-repeat must not create a second level-up selection');
  input.onKeyUp({ code: 'Digit1' });
  key('KeyC', { ctrlKey: true });
  assert.equal(input.isDown('KeyC'), false, 'browser/system shortcuts must not leak into gameplay');

  const levelHarness = () => {
    const game = Object.create(Game.prototype); const views = []; const states = []; const audioEvents = [];
    let neutral = true; let cleared = 0; let focused = 0;
    game.mode = 'running'; game.pendingLevels = []; game.pendingDefeat = false; game.endTimer = 0;
    game.levelPhase = 'idle'; game.levelPhaseTime = 0; game.levelSelectionLocked = false; game.levelOptions = [];
    game.player = {
      x: 0, y: 0, hp: 100, maxHp: 120, damage: 24, attackRate: .42, speed: 205, dashCooldown: 1.35,
      range: 78, critChance: .12, armor: 3, lifeSteal: 0, burnChance: 0, roomHeal: 0, dashShield: false,
      level: 1, xp: 0, xpNeeded: XP_FOR_LEVEL(1), upgrades: []
    };
    game.input = {
      reset() {}, isNeutral: () => neutral, consume: () => false
    };
    game.audio = {
      captureScene: () => ({ scene: 'combat' }),
      beginLevelUp: snapshot => audioEvents.push(['begin', snapshot.scene]),
      playLevelUpFanfare: stacked => audioEvents.push(['fanfare', stacked]),
      playLevelUpConfirm: () => audioEvents.push(['confirm']),
      restoreScene: snapshot => audioEvents.push(['restore', snapshot.scene])
    };
    game.ui = {
      showLevelUp: (options, level, state) => views.push({ level, state, ids: options.map(option => option.id) }),
      setLevelUpState: (state, id) => states.push([state, id]), toast() {}, clearOverlay: () => { cleared++; }
    };
    game.tutorial = { queue() {} }; game.canvas = { focus: () => { focused++; } };
    return { game, views, states, audioEvents, setNeutral: value => { neutral = value; }, cleared: () => cleared, focused: () => focused };
  };

  {
    const h = levelHarness();
    h.game.gainXp(XP_FOR_LEVEL(1) + XP_FOR_LEVEL(2));
    assert.equal(h.game.mode, 'running', 'XP thresholds must only queue rewards during the simulation tick');
    assert.deepEqual(h.game.pendingLevels.map(reward => reward.level), [2, 3], 'multi-level rewards need their exact reached levels');
    assert.equal(h.game.resolveLevelUpEvent(), true, 'the safe tick-end resolver should open a queued reward');
    assert.deepEqual(h.views.map(view => view.level), [2], 'the first queued level must be presented first');

    h.setNeutral(false); h.game.updateLevelUp(.8);
    assert.equal(h.game.levelPhase, 'intro', 'held attack or selection input must keep the intro locked after 700 ms');
    h.setNeutral(true); h.game.updateLevelUp(0);
    assert.equal(h.game.levelPhase, 'choosing', 'released controls should arm the three choices after the intro');

    const firstChoice = h.game.levelOptions[0].id;
    h.game.chooseUpgrade(firstChoice); h.game.chooseUpgrade(firstChoice);
    assert.equal(h.game.player.upgrades.length, 1, 'double click/re-entrant commits must apply exactly one upgrade');
    assert.equal(h.game.pendingLevels.length, 1, 'an atomic commit must remove exactly one queued level');
    h.game.updateLevelUp(.23);
    assert.deepEqual(h.views.map(view => view.level), [2, 3], 'stacked rewards must advance to the next exact level');

    h.game.updateLevelUp(.71); const secondChoice = h.game.levelOptions[0].id; h.game.chooseUpgrade(secondChoice);
    h.game.updateLevelUp(.23); h.game.updateLevelUp(.19);
    assert.equal(h.game.player.upgrades.length, 2, 'every stacked level should grant exactly one committed upgrade');
    assert.equal(h.game.mode, 'running', 'the short exit phase must return to the run');
    assert.deepEqual(h.audioEvents.at(-1), ['restore', 'combat'], 'the pre-level-up audio scene must be restored');
    assert.equal(h.cleared(), 1, 'the level overlay should clear once after the final reward');
    assert.equal(h.focused(), 1, 'gameplay focus should return to the canvas');
  }

  {
    const defeat = levelHarness(); const results = [];
    defeat.game.gainXp(XP_FOR_LEVEL(1)); defeat.game.pendingDefeat = true;
    defeat.game.finish = victory => { results.push(victory); defeat.game.mode = 'ending'; };
    assert.equal(defeat.game.resolveTerminalEvents(.016), true);
    assert.deepEqual(results, [false], 'death must win over a queued level-up');
    assert.equal(defeat.game.pendingLevels.length, 0, 'terminal events must discard unusable level rewards');
    assert.equal(defeat.views.length, 0, 'death must not flash a level-up dialog');

    const victory = levelHarness(); const victoryResults = [];
    victory.game.gainXp(XP_FOR_LEVEL(1)); victory.game.endTimer = .01;
    victory.game.finish = won => { victoryResults.push(won); victory.game.mode = 'ending'; };
    assert.equal(victory.game.resolveTerminalEvents(.016), true);
    assert.deepEqual(victoryResults, [true], 'boss victory must win over a queued level-up');
    assert.equal(victory.views.length, 0, 'boss victory must not open a redundant reward dialog');
  }

  assert.deepEqual(defaultSettings.tutorialHints, true);

  console.log('UI, input, tutorial, and storage tests passed.');
} finally {
  await server.close();
}
