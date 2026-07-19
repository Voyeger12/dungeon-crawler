import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });

const room = (id, gx, gy, overrides = {}) => ({
  id, gx, gy, kind: 'combat', state: 'undiscovered', depth: 1, visited: false, connections: {}, ...overrides
});

try {
  const { buildMapViewModel, renderMapViewMarkup, MAP_VIEW_LEGEND } = await server.ssrLoadModule('/src/map-view.ts');

  const rooms = new Map([
    ['start', room('start', -3, -2, { kind: 'start', state: 'cleared', visited: true, connections: { east: 'hall' } })],
    ['hall', room('hall', -2, -2, { state: 'active', visited: true, connections: { west: 'start', east: 'vault', south: 'hidden' } })],
    ['vault', room('vault', 2, -2, { kind: 'treasure', state: 'ready', connections: { west: 'hall' } })],
    ['hidden', room('hidden', -2, 4, { kind: 'boss', connections: { north: 'hall', east: 'remote' } })],
    ['remote', room('remote', 9, 9, { kind: 'rest', connections: { west: 'hidden' } })]
  ]);

  const model = buildMapViewModel(rooms, rooms.get('hall'));
  assert.equal(model.empty, false);
  assert.deepEqual(model.nodes.map(node => node.id).sort(), ['hall', 'hidden', 'start', 'vault'], 'visited and directly adjacent rooms should be visible, remote undiscovered rooms should not');
  assert.ok(model.nodes.every(node => node.xPercent >= 4 && node.xPercent <= 96 && node.yPercent >= 4 && node.yPercent <= 96), 'negative and sparse coordinates must normalize into percentage bounds');
  assert.equal(model.nodes.find(node => node.id === 'hall').current, true, 'the current room needs an explicit semantic state');
  assert.equal(model.nodes.find(node => node.id === 'vault').kind, 'unknown', 'an unvisited adjacent room must not leak its room type');
  assert.match(model.nodes.find(node => node.id === 'vault').label, /noch nicht betreten/);

  assert.equal(model.links.length, 3, 'bidirectional connections must render only once');
  assert.equal(new Set(model.links.map(link => [link.fromId, link.toId].sort().join('|'))).size, model.links.length, 'link pairs must be unique');
  assert.ok(model.links.every(link => Number.isFinite(link.lengthPercent) && Number.isFinite(link.angleDegrees)), 'connection geometry must remain finite');

  const markup = renderMapViewMarkup(model);
  assert.match(markup, /role="img"/);
  assert.match(markup, /aria-label="Kartenlegende"/);
  assert.match(markup, /map-view-room-list sr-only/);
  assert.doesNotMatch(markup, /left:\d+px|top:\d+px|width:\d+px/, 'layout must not depend on fixed pixel coordinates');
  assert.match(markup, /left:\d+\.\d{3}%;top:\d+\.\d{3}%/, 'room and link positions should use normalized percentages');
  assert.equal(MAP_VIEW_LEGEND.some(entry => entry.kind === 'boss' && entry.label === 'Bosshalle'), true, 'legend data must label room types without emoji');
  assert.equal(MAP_VIEW_LEGEND.every(entry => /^[A-Z?]{1,2}$/.test(entry.marker)), true, 'markers should be controlled text glyphs rather than emoji');

  const malicious = new Map([
    ['"><img src=x onerror=alert(1)>', room('ignored', 0, 0, { kind: 'start', visited: true, state: 'cleared' })]
  ]);
  const maliciousModel = buildMapViewModel(malicious, '"><img src=x onerror=alert(1)>');
  const safeMarkup = renderMapViewMarkup(maliciousModel);
  assert.doesNotMatch(safeMarkup, /<img src=x/);
  assert.match(safeMarkup, /&quot;&gt;&lt;img/);

  const empty = buildMapViewModel(new Map(), 'missing');
  assert.equal(empty.empty, true);
  assert.deepEqual(empty.nodes, []);
  assert.deepEqual(empty.links, []);
  assert.match(renderMapViewMarkup(empty), /Noch keine Räume/);

  const single = buildMapViewModel(new Map([['only', room('only', Number.NaN, Number.NEGATIVE_INFINITY, { visited: true, kind: 'rest' })]]), 'only');
  assert.equal(single.nodes[0].xPercent, 50, 'invalid or single-axis coordinates should center safely');
  assert.equal(single.nodes[0].yPercent, 50, 'invalid or single-axis coordinates should center safely');
  assert.equal(single.links.length, 0);

  console.log('Large map view tests passed.');
} finally {
  await server.close();
}
