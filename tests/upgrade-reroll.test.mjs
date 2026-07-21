import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });

try {
  const { Game } = await server.ssrLoadModule('/src/game.ts');
  const { UPGRADES } = await server.ssrLoadModule('/src/config.ts');
  const { createUpgradeOffers, getRerollCost, isUpgradeEligible, REROLL_FAILURE_MESSAGE } = await server.ssrLoadModule('/src/upgrade-offers.ts');

  assert.deepEqual([0, 1, 2, 3].map(getRerollCost), [25, 50, 75, 100], 'reroll costs must rise linearly by 25 gold');

  const player = {
    upgrades: [], attackRate: .42, dashCooldown: 1.35, critChance: .12, burnChance: 0, dashShield: false
  };
  const first = createUpgradeOffers(player, [], () => 0);
  assert.equal(first.length, 3, 'a level-up must always offer three upgrades');
  assert.equal(new Set(first.map(upgrade => upgrade.id)).size, 3, 'a level-up must not contain duplicate upgrades');

  const second = createUpgradeOffers(player, first.map(upgrade => upgrade.id), () => 0);
  assert.equal(second.some(upgrade => first.some(previous => previous.id === upgrade.id)), false, 'rerolls should avoid the previous three offers when the pool permits it');

  const maximized = {
    upgrades: ['fury', 'fury', 'fury', 'fury', 'fury', 'fury', 'dash', 'dash', 'dash', 'dash', 'dash', 'critical', 'critical', 'critical', 'critical', 'critical', 'critical', 'critical', 'burn', 'dashShield'],
    attackRate: .18, dashCooldown: .55, critChance: .65, burnChance: .35, dashShield: true
  };
  for (const id of ['fury', 'dash', 'critical', 'burn', 'dashShield']) {
    assert.equal(isUpgradeEligible(maximized, id), false, `${id} must disappear after reaching its cap`);
  }
  const eligibleIds = UPGRADES.filter(upgrade => isUpgradeEligible(maximized, upgrade.id)).map(upgrade => upgrade.id);
  const constrained = createUpgradeOffers(maximized, eligibleIds, () => .999);
  assert.equal(constrained.length, 3, 'even a fully excluded previous pool must fall back to three valid offers');
  assert.equal(new Set(constrained.map(upgrade => upgrade.id)).size, 3, 'fallback offers must remain unique');
  assert.equal(constrained.every(upgrade => isUpgradeEligible(maximized, upgrade.id)), true, 'fallback offers must remain valid');

  const makeHarness = gold => {
    const game = Object.create(Game.prototype); const states = []; const rerollViews = []; const replacements = []; const messages = []; const sounds = [];
    game.mode = 'level'; game.levelPhase = 'choosing'; game.levelPhaseTime = 0; game.levelSelectionLocked = false;
    game.levelRerollCount = 0; game.levelRerollSwapped = false; game.pendingRerollOptions = [];
    game.player = { ...player, gold };
    game.levelOptions = createUpgradeOffers(game.player, [], () => 0);
    game.input = { consume: () => false };
    game.ui = {
      setLevelUpState: state => states.push(state),
      updateLevelReroll: (view, locked = false) => rerollViews.push({ ...view, locked }),
      replaceLevelUpOptions: options => replacements.push(options.map(option => option.id)),
      showLevelRerollMessage: message => messages.push(message)
    };
    game.audio = { play: name => sounds.push(name), playLevelUpReroll: () => sounds.push('reroll') };
    return { game, states, rerollViews, replacements, messages, sounds };
  };

  {
    const h = makeHarness(200); const before = h.game.levelOptions.map(option => option.id);
    h.game.rerollUpgrades(); h.game.rerollUpgrades();
    assert.equal(h.game.player.gold, 175, 'a double click must deduct the first reroll cost exactly once');
    assert.equal(h.game.levelRerollCount, 1, 'only one completed reroll may be recorded while the animation is locked');
    assert.equal(h.sounds.filter(sound => sound === 'reroll').length, 1, 'the reroll sound must only play once');
    assert.equal(h.rerollViews.at(-1).cost, 50, 'the button must immediately expose the next reroll price');
    assert.equal(h.rerollViews.at(-1).gold, 175, 'the level-up wallet must update immediately');
    h.game.updateLevelUp(.23);
    assert.equal(h.replacements.length, 1, 'new tablets must replace the old set at the animation swap point');
    assert.notDeepEqual(h.replacements[0], before, 'a successful reroll must replace the visible offers');
    h.game.updateLevelUp(.26);
    assert.equal(h.game.levelPhase, 'choosing', 'selection must unlock after the reroll animation');
    h.game.rerollUpgrades();
    assert.equal(h.game.player.gold, 125, 'the second reroll in the same selection must cost 50 gold');
  }

  {
    const h = makeHarness(24); const before = h.game.levelOptions.map(option => option.id);
    h.game.rerollUpgrades();
    assert.equal(h.game.player.gold, 24, 'insufficient gold must never be deducted');
    assert.deepEqual(h.game.levelOptions.map(option => option.id), before, 'insufficient gold must not replace the offers');
    assert.deepEqual(h.messages, [REROLL_FAILURE_MESSAGE], 'the lore-appropriate insufficient-funds message must be shown');
    assert.equal(h.sounds.includes('reroll'), false, 'a rejected reroll must not play the success sound');
  }

  console.log('Upgrade reroll economy and validity tests passed.');
} finally {
  await server.close();
}
