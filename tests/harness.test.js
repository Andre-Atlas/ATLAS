'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { getHarness, toAntigravityAgent } = require('../scripts/lib/harness');

const agent = `---
name: code-reviewer
description: Revisa diffs: correção, segurança e estilo.
tools: Read, Grep, Glob, Bash, Task
model: sonnet
color: blue
---

# Corpo

Texto com tools: Read no corpo, que não muda.
`;

test('adapts Claude Code agent frontmatter to Antigravity', () => {
  const out = toAntigravityAgent(agent);
  assert.ok(out.includes('name: code-reviewer\n'));
  assert.ok(out.includes('description: Revisa diffs: correção, segurança e estilo.\n'));
  assert.ok(out.includes('tools: [view_file, grep_search, find_by_name, run_command]\n'), 'ferramenta desconhecida (Task) deve sair');
  assert.ok(out.includes('model: pro\n'));
  assert.ok(!out.includes('color:'));
  assert.ok(out.endsWith('# Corpo\n\nTexto com tools: Read no corpo, que não muda.\n'));
});

test('maps haiku to flash, accepts list syntax and rejects missing frontmatter', () => {
  const out = toAntigravityAgent('---\nname: x\ntools: ["Read", "Write"]\nmodel: haiku\n---\nb\n');
  assert.ok(out.includes('tools: [view_file, write_to_file]'));
  assert.ok(out.includes('model: flash'));
  assert.throws(() => toAntigravityAgent('sem frontmatter'), /sem frontmatter/);
});

test('harness table knows where each harness reads agents and instructions', () => {
  assert.deepStrictEqual(getHarness('claude-code').agentsDir, ['.claude', 'agents']);
  assert.strictEqual(getHarness('claude-code').adaptAgent(agent), agent);
  assert.deepStrictEqual(getHarness('antigravity').agentsDir, ['.agents', 'agents']);
  assert.strictEqual(getHarness('antigravity').instructionsFile, 'AGENTS.md');
  assert.throws(() => getHarness('vim'), /Harness não suportado/);
});

test('global paths live in the home folder', () => {
  const cc = getHarness('claude-code', { global: true });
  assert.deepStrictEqual(cc.agentsDir, ['.claude', 'agents']);
  assert.strictEqual(cc.instructionsFile, '.claude/CLAUDE.md');
  const ag = getHarness('antigravity', { global: true });
  assert.deepStrictEqual(ag.agentsDir, ['.gemini', 'config', 'agents']);
  assert.strictEqual(ag.instructionsFile, '.gemini/AGENTS.md');
  assert.ok(ag.global && !getHarness('antigravity').global);
});

test('skills are installed with --global only for a global install', () => {
  const { skillsAddArgs } = require('../scripts/lib/sources');
  assert.ok(!skillsAddArgs('x', ['a'], 'claude-code').includes('--global'));
  assert.ok(skillsAddArgs('x', ['a'], 'claude-code', true).includes('--global'));
});
