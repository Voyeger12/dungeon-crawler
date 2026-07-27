import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });

try {
  const { ASSET_MANIFEST } = await server.ssrLoadModule('/src/assets.ts');
  const [index, ui] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui.ts', import.meta.url), 'utf8')
  ]);

  assert.equal(ASSET_MANIFEST.brandCrest.path, '/assets/branding/runedeep-crest.png');
  assert.equal(ASSET_MANIFEST.brandMark256.path, '/assets/branding/runedeep-mark-256.png');
  assert.equal(ASSET_MANIFEST.brandMark64.path, '/assets/branding/runedeep-mark-64.png');
  for (const asset of ['runedeep-crest.png', 'runedeep-mark-256.png', 'runedeep-mark-64.png']) {
    const info = await stat(new URL(`../public/assets/branding/${asset}`, import.meta.url));
    assert.ok(info.size > 1000, `${asset} should contain authored brand art`);
  }

  assert.match(index, /<title>Runedeep: Beneath the Broken Crown<\/title>/);
  assert.match(index, /rel="icon"[^>]+runedeep-mark-64\.png/);
  assert.match(index, /id="minimap-content"/);
  assert.match(ui, /class="brand-crest"/);
  assert.match(ui, /<span>RUNE<\/span><em>DEEP<\/em>/, 'the title must remain crisp, accessible HTML text');
  assert.match(ui, /BENEATH THE BROKEN CROWN/);
  assert.doesNotMatch(ui, /<span>RD<\/span>/, 'the temporary text monogram should be retired');

  console.log('Brand system tests passed.');
} finally {
  await server.close();
}
