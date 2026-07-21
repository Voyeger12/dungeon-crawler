import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });

try {
  const { AudioManager, MUSIC_TEMPOS, getMusicStepPlan } = await server.ssrLoadModule('/src/audio.ts');

  assert.deepEqual(MUSIC_TEMPOS, { calm: 72, combat: 104, boss: 122 }, 'music intensity must increase through the three gameplay scenes');

  const sceneStats = {};
  for (const state of ['calm', 'combat', 'boss']) {
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
  class FakeBufferSource extends FakeNode { buffer = null; start() {} stop() {} }
  let oscillatorCount = 0; let bufferSourceCount = 0; let scheduledMusic;
  class FakeAudioContext {
    currentTime = 0; state = 'running'; sampleRate = 48000; destination = new FakeNode();
    createGain() { return new FakeGain(); }
    createBiquadFilter() { return new FakeFilter(); }
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

  console.log('Adaptive medieval music regression tests passed.');
} finally {
  await server.close();
}
