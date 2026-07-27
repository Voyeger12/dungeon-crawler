import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });

try {
  const {
    AudioManager,
    MUSIC_TEMPOS,
    SCORE_CROSSFADE_SECONDS,
    SCORE_SCENES,
    SCORE_TRACKS,
    getMusicStepPlan
  } = await server.ssrLoadModule('/src/audio.ts');

  assert.deepEqual(MUSIC_TEMPOS, { menu: 68, intro: 80, calm: 72, combat: 104, boss: 122 }, 'each presentation and gameplay scene needs a deliberate fallback tempo');
  assert.deepEqual(SCORE_SCENES, { menu: 'oath', intro: 'omen', calm: 'vault', combat: 'clash', boss: 'crown' }, 'each presentation and gameplay scene needs its dedicated Suno master');
  assert.equal(SCORE_TRACKS.oath.path, '/assets/audio/music/broken-crown-oath.mp3');
  assert.equal(SCORE_TRACKS.omen.path, '/assets/audio/music/runedeep-omen.mp3');
  assert.equal(SCORE_TRACKS.vault.path, '/assets/audio/music/runedeep-vault.mp3');
  assert.equal(SCORE_TRACKS.clash.path, '/assets/audio/music/runedeep-clash.mp3');
  assert.equal(SCORE_TRACKS.crown.path, '/assets/audio/music/runedeep-crown.mp3');
  assert.ok(SCORE_CROSSFADE_SECONDS >= 1.5 && SCORE_CROSSFADE_SECONDS <= 2.5, 'score changes need a musical rather than abrupt crossfade');
  const oathFile = await stat(new URL('../public/assets/audio/music/broken-crown-oath.mp3', import.meta.url));
  const omenFile = await stat(new URL('../public/assets/audio/music/runedeep-omen.mp3', import.meta.url));
  const vaultFile = await stat(new URL('../public/assets/audio/music/runedeep-vault.mp3', import.meta.url));
  const clashFile = await stat(new URL('../public/assets/audio/music/runedeep-clash.mp3', import.meta.url));
  const crownFile = await stat(new URL('../public/assets/audio/music/runedeep-crown.mp3', import.meta.url));
  assert.ok(oathFile.size > 7_000_000 && omenFile.size > 5_000_000 && vaultFile.size > 8_000_000 && clashFile.size > 6_000_000 && crownFile.size > 4_000_000, 'all five local music masters must be present and non-truncated');

  const sceneStats = {};
  for (const state of ['menu', 'intro', 'calm', 'combat', 'boss']) {
    const signatures = [];
    const drumCounts = [];
    for (let variation = 0; variation < 3; variation++) {
      const plans = Array.from({ length: 64 }, (_, step) => getMusicStepPlan(state, step, variation));
      const pitched = plans.flatMap(plan => [plan.bass, plan.lute, plan.reed, plan.bell].filter(Number.isFinite));
      const drums = plans.reduce((sum, plan) => sum + plan.drums.length, 0);
      assert.equal(plans.filter(plan => plan.openFifth).length, 4, `${state} needs one open-fifth cadence per bar`);
      assert.equal(pitched.every(note => note >= 30 && note <= 90), true, `${state} notes must remain in a safe musical register`);
      assert.ok(new Set(pitched).size >= 7, `${state} must contain enough modal pitch variety to avoid a drone`);
      signatures.push(plans.map(plan => `${plan.root}:${plan.lute ?? '-'}:${plan.reed ?? '-'}`).join('|'));
      drumCounts.push(drums);
    }
    assert.equal(new Set(signatures).size, 3, `${state} must rotate through three genuinely different phrases`);
    sceneStats[state] = { drums: Math.min(...drumCounts) };
  }

  assert.ok(sceneStats.combat.drums > sceneStats.calm.drums, 'combat must add a clearly denser medieval percussion layer');
  assert.ok(sceneStats.boss.drums > sceneStats.combat.drums, 'boss music must intensify beyond ordinary combat');
  assert.equal(Array.from({ length: 64 }, (_, step) => getMusicStepPlan('boss', step, 0)).some(plan => plan.reed === 63), true, 'the boss motif must use its tense Phrygian semitone');

  const settings = { master: .8, music: .3, sfx: .7, muted: false };
  const audio = new AudioManager(settings);
  audio.setMusicState('combat');
  assert.deepEqual(audio.captureScene(), { scene: 'combat' });
  audio.beginLevelUp(audio.captureScene());
  audio.setMusicState('boss');
  assert.deepEqual(audio.captureScene(), { scene: 'boss' }, 'a combat change during level-up must update the scene restored afterward');
  audio.restoreScene(audio.captureScene());
  assert.deepEqual(audio.captureScene(), { scene: 'boss' });

  class FakeParam {
    value = 0;
    setValueAtTime(value) { this.value = value; }
    setTargetAtTime(value) { this.value = value; }
    exponentialRampToValueAtTime(value) { this.value = value; }
    cancelScheduledValues() {}
  }
  class FakeNode { connect(target) { return target; } }
  class FakeGain extends FakeNode { gain = new FakeParam(); }
  class FakeFilter extends FakeNode { frequency = new FakeParam(); Q = new FakeParam(); type = 'lowpass'; }
  class FakeOscillator extends FakeNode {
    frequency = new FakeParam(); detune = new FakeParam(); type = 'sine';
    start() {} stop() {}
  }
  const createdBufferSources = [];
  class FakeBufferSource extends FakeNode {
    buffer = null; loop = false; loopStart = 0; loopEnd = 0; startAt = null; offset = null; stopAt = null;
    constructor() { super(); createdBufferSources.push(this); }
    start(at, offset) { this.startAt = at; this.offset = offset; }
    stop(at) { this.stopAt = at; }
  }
  let oscillatorCount = 0; let bufferSourceCount = 0; let scheduledMusic;
  class FakeAudioContext {
    currentTime = 0; state = 'running'; sampleRate = 48000; destination = new FakeNode();
    createGain() { return new FakeGain(); }
    createBiquadFilter() { return new FakeFilter(); }
    createMediaElementSource() { return new FakeNode(); }
    createOscillator() { oscillatorCount++; return new FakeOscillator(); }
    createBufferSource() { bufferSourceCount++; return new FakeBufferSource(); }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    resume() { return Promise.resolve(); }
  }
  globalThis.window = {
    AudioContext: FakeAudioContext,
    setInterval: callback => { scheduledMusic = callback; return 1; }
  };
  const liveAudio = new AudioManager({ master: .8, music: .3, sfx: .7, muted: false });
  liveAudio.start(); scheduledMusic();
  const calmSources = oscillatorCount + bufferSourceCount;
  liveAudio.setMusicState('combat'); scheduledMusic();
  assert.ok(calmSources > 0, 'the calm scheduler must create audible plucked and percussion sources');
  assert.ok(oscillatorCount + bufferSourceCount > calmSources, 'combat transition and scheduler must add their denser layers without throwing');

  const mediaElements = [];
  class FakeAudioElement {
    src = ''; preload = ''; loop = false; currentTime = 0; playCount = 0; pauseCount = 0;
    constructor() { mediaElements.push(this); }
    load() {}
    play() { this.playCount++; return Promise.resolve(); }
    pause() { this.pauseCount++; }
  }
  const pendingTimeouts = [];
  globalThis.window.Audio = FakeAudioElement;
  globalThis.window.setTimeout = callback => { pendingTimeouts.push(callback); return pendingTimeouts.length; };
  const sampleAudio = new AudioManager({ master: .8, music: .3, sfx: .7, muted: false });
  sampleAudio.start();
  assert.equal(await sampleAudio.preloadScore(), true, 'all five local masters must enter the shared Web Audio mixer');
  assert.equal(sampleAudio.hasSampleScore(), true);
  assert.deepEqual(mediaElements.map(element => element.src), Object.values(SCORE_TRACKS).map(track => track.path), 'each compressed master must be prepared exactly once');
  const menuSource = mediaElements[0];
  const introSource = mediaElements[1];
  const explorationSource = mediaElements[2];
  assert.equal(explorationSource.loop, true, 'the exploration master must loop continuously');
  assert.equal(explorationSource.preload, 'auto');
  assert.equal(explorationSource.playCount, 1);
  assert.equal(menuSource.loop, true, 'the main-menu oath must loop continuously');
  assert.equal(introSource.loop, false, 'the narrative intro must play as a finite cue');
  sampleAudio.setMusicState('menu');
  pendingTimeouts.splice(0).forEach(callback => callback());
  assert.equal(menuSource.playCount, 1, 'the title screen must switch to Broken Crown Oath');
  assert.equal(explorationSource.pauseCount, 1, 'the title transition must fade the exploration stream out');
  introSource.currentTime = 23;
  sampleAudio.setMusicState('intro');
  pendingTimeouts.splice(0).forEach(callback => callback());
  assert.equal(introSource.playCount, 1, 'the cinematic must switch to Runedeep Omen');
  assert.equal(introSource.currentTime, 0, 'each replay must restart the finite intro cue');
  sampleAudio.setMusicState('combat');
  pendingTimeouts.splice(0).forEach(callback => callback());
  const combatSource = mediaElements[3];
  assert.equal(combatSource.playCount, 1, 'combat must crossfade to its dedicated master');
  assert.equal(introSource.pauseCount, 1, 'the outgoing intro may pause only after its fade');
  sampleAudio.beginLevelUp(sampleAudio.captureScene());
  assert.ok(sampleAudio.score.gain.value < .1, 'the sample score must duck beneath the level-up fanfare');
  sampleAudio.restoreScene(sampleAudio.captureScene());
  assert.ok(sampleAudio.score.gain.value > .2, 'the score level must recover after the upgrade choice');

  console.log('Adaptive medieval music regression tests passed.');
} finally {
  await server.close();
}
