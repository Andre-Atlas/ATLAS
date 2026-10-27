'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { main, parseCli } = require('../scripts/atlas');
const { detectHarnesses, planModules, dropped } = require('../scripts/lib/project');

const ECC = process.env.ATLAS_ECC_PATH;

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function quiet(fn) {
  const write = process.stdout.write;
  process.stdout.write = () => true;
  try {
    return await fn();
  } finally {
    process.stdout.write = write;
  }
}

test('parseCli separates command, names, agents and installer flags', () => {
  const c = parseCli(['add', 'lane-audit', 'stack-node', '--agent', 'antigravity,claude-code', '-y', '--target', '/x', '--dry-run']);
  assert.strictEqual(c.command, 'add');
  assert.deepStrictEqual(c.names, ['lane-audit', 'stack-node']);
  assert.deepStrictEqual(c.agents, ['antigravity', 'claude-code']);
  assert.ok(c.yes);
  assert.deepStrictEqual(c.rest, ['--target', '/x', '--dry-run']);
  assert.throws(() => parseCli(['init', '--agent', 'vim']), /Harness não suportado/);
});

test('detects harnesses from the project first, then from home', () => {
  const home = tmp('atlas-home-');
  const proj = tmp('atlas-proj-');
  assert.deepStrictEqual(detectHarnesses(proj, home), []);
  fs.mkdirSync(path.join(home, '.gemini', 'antigravity-cli'), { recursive: true });
  assert.deepStrictEqual(detectHarnesses(proj, home), ['antigravity-cli']);
  fs.mkdirSync(path.join(home, '.gemini', 'antigravity'), { recursive: true });
  fs.mkdirSync(path.join(home, '.claude'));
  assert.deepStrictEqual(detectHarnesses(proj, home), ['claude-code', 'antigravity']);
  fs.writeFileSync(path.join(proj, 'CLAUDE.md'), '');
  assert.deepStrictEqual(detectHarnesses(proj, home), ['claude-code']);
});

test('planModules keeps the profile when possible and falls back to minimal', () => {
  const web = { profile: 'web', modules: ['core', 'lane-design', 'lane-architecture', 'lane-audit', 'stack-react'] };
  assert.deepStrictEqual(planModules(web, { add: ['stack-node'] }).profile, 'web');
  assert.ok(planModules(web, { add: ['stack-node'] }).with.includes('stack-node'));
  const removed = planModules(web, { remove: ['lane-audit'] });
  assert.strictEqual(removed.profile, 'minimal');
  assert.ok(!removed.with.includes('lane-audit'));
  assert.throws(() => planModules(web, { remove: ['core'] }), /core/);
  assert.throws(() => planModules(web, { remove: ['stack-python'] }), /não está instalado/);
});

test('dropped lists only what disappears', () => {
  const before = { skills: { ecc: ['a', 'b'] }, agents: { atlas: ['x'], ecc: ['y'] } };
  const after = { skills: { ecc: ['a'] }, agents: { ecc: ['y'] } };
  assert.deepStrictEqual(dropped(before, after), {
    skills: [{ source: 'ecc', name: 'b' }],
    agents: [{ source: 'atlas', name: 'x' }],
  });
});

test('init, add, remove and update keep agents and manifest in sync', { skip: !ECC && 'defina ATLAS_ECC_PATH' }, async () => {
  const dir = tmp('atlas-proj-');
  const base = ['--target', dir, '--skip-skills', '--ecc-path', ECC, '-y'];
  const agentFile = (name) => path.join(dir, '.agents', 'agents', `${name}.md`);
  const manifest = () => JSON.parse(fs.readFileSync(path.join(dir, '.atlas', 'atlas.json'), 'utf8'));

  await quiet(() => main(['init', '--profile', 'minimal', '--agent', 'antigravity', ...base]));
  assert.ok(fs.existsSync(agentFile('maestro')));
  assert.ok(!fs.existsSync(agentFile('audit-lead')));

  await quiet(() => main(['add', 'lane-audit', ...base]));
  assert.ok(fs.existsSync(agentFile('audit-lead')));
  assert.ok(manifest().modules.includes('lane-audit'));
  assert.deepStrictEqual(manifest().harnesses, ['antigravity']);

  await quiet(() => main(['remove', 'lane-audit', ...base]));
  assert.ok(!fs.existsSync(agentFile('audit-lead')));
  assert.ok(fs.existsSync(agentFile('maestro')));
  assert.ok(!manifest().modules.includes('lane-audit'));

  await quiet(() => main(['update', ...base]));
  assert.deepStrictEqual(manifest().modules, ['core']);
  await assert.rejects(() => main(['add', ...base]), /Diga quais módulos/);
  await assert.rejects(() => main(['update', '--target', tmp('atlas-empty-')]), /não está instalado/);
});

test('--global installs in the home folder for every harness', { skip: !ECC && 'defina ATLAS_ECC_PATH' }, async () => {
  const home = tmp('atlas-home-');
  const previous = process.env.ATLAS_HOME;
  process.env.ATLAS_HOME = home;
  try {
    const base = ['--global', '--skip-skills', '--ecc-path', ECC, '-y'];
    await quiet(() => main(['init', '--profile', 'minimal', '--agent', 'claude-code,antigravity', ...base]));
    assert.ok(fs.existsSync(path.join(home, '.claude', 'agents', 'maestro.md')));
    assert.match(fs.readFileSync(path.join(home, '.gemini', 'config', 'agents', 'maestro.md'), 'utf8'), /^model: pro$/m);
    assert.match(fs.readFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'utf8'), /instalado globalmente/);
    assert.match(fs.readFileSync(path.join(home, '.gemini', 'AGENTS.md'), 'utf8'), /~\/\.gemini\/config\/agents\//);
    const manifest = JSON.parse(fs.readFileSync(path.join(home, '.atlas', 'atlas.json'), 'utf8'));
    assert.strictEqual(manifest.scope, 'global');
    assert.deepStrictEqual(manifest.harnesses, ['antigravity', 'claude-code']);

    await quiet(() => main(['add', 'lane-audit', ...base]));
    assert.ok(fs.existsSync(path.join(home, '.gemini', 'config', 'agents', 'audit-lead.md')));
    await quiet(() => main(['remove', 'lane-audit', ...base]));
    assert.ok(!fs.existsSync(path.join(home, '.claude', 'agents', 'audit-lead.md')));
  } finally {
    if (previous === undefined) delete process.env.ATLAS_HOME;
    else process.env.ATLAS_HOME = previous;
  }
});
