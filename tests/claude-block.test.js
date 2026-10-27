'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { BEGIN, END, renderBlock, upsertBlock } = require('../scripts/lib/claude-block');

const manifest = { profile: 'web', lanes: ['design'], stacks: ['react'] };

test('creates the block in an empty file', () => {
  const out = upsertBlock('', renderBlock(manifest));
  assert.ok(out.startsWith(BEGIN));
  assert.ok(out.trimEnd().endsWith(END));
  assert.ok(out.includes('`atlas-maestro`'));
});

test('appends after existing content without touching it', () => {
  const original = '# Meu projeto\n\nRegras da casa.\n';
  const out = upsertBlock(original, renderBlock(manifest));
  assert.ok(out.startsWith(original));
  assert.ok(out.includes(BEGIN));
});

test('replaces an existing block in place and is idempotent', () => {
  const before = '# Projeto\n\n';
  const after = '\n\n## Outras notas\n';
  const first = upsertBlock(`${before}${renderBlock(manifest)}${after}`, renderBlock({ ...manifest, lanes: [] }));
  assert.ok(first.startsWith(before));
  assert.ok(first.endsWith(after));
  assert.ok(first.includes('nenhuma (só o núcleo)'));
  assert.strictEqual(first.split(BEGIN).length, 2);
  assert.strictEqual(upsertBlock(first, renderBlock({ ...manifest, lanes: [] })), first);
});

test('adds Antigravity notes only for Antigravity', () => {
  assert.ok(!renderBlock(manifest).includes('invoke_subagent'));
  assert.ok(renderBlock(manifest, 'antigravity').includes('invoke_subagent'));
  assert.ok(renderBlock(manifest, 'antigravity-cli').includes('references/antigravity.md'));
});
