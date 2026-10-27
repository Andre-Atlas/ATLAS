'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { main, parseArgs } = require('../scripts/atlas-install');

const ECC = process.env.ATLAS_ECC_PATH;

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-proj-'));
}

function quiet(fn) {
  const write = process.stdout.write;
  process.stdout.write = () => true;
  try {
    return fn();
  } finally {
    process.stdout.write = write;
  }
}

test('parseArgs reads options and rejects unknown flags', () => {
  const o = parseArgs(['--target', '/tmp', '--profile', 'web', '--with', 'lane-audit, stack-node', '--dry-run']);
  assert.strictEqual(o.profile, 'web');
  assert.deepStrictEqual(o.with, ['lane-audit', 'stack-node']);
  assert.ok(o.dryRun);
  assert.throws(() => parseArgs(['--nope']), /Opção desconhecida/);
  assert.throws(() => parseArgs(['--target']), /Falta valor/);
});

test('dry run writes nothing', () => {
  const dir = tempProject();
  quiet(() => main(['--target', dir, '--profile', 'web', '--dry-run']));
  assert.deepStrictEqual(fs.readdirSync(dir), []);
});

test('installs agents, manifest and CLAUDE.md block, and re-running is idempotent', { skip: !ECC && 'defina ATLAS_ECC_PATH' }, () => {
  const dir = tempProject();
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Projeto existente\n');
  const args = ['--target', dir, '--profile', 'web', '--skip-skills', '--ecc-path', ECC];

  quiet(() => main(args));
  const agents = fs.readdirSync(path.join(dir, '.claude', 'agents'));
  for (const a of ['maestro.md', 'design-director.md', 'audit-lead.md', 'code-reviewer.md', 'a11y-architect.md', 'react-reviewer.md']) {
    assert.ok(agents.includes(a), `faltou ${a}`);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.atlas', 'atlas.json'), 'utf8'));
  assert.deepStrictEqual(manifest.lanes, ['design', 'arquitetura', 'auditoria']);
  assert.deepStrictEqual(manifest.stacks, ['react']);
  assert.ok(manifest.sources.ecc.local);

  const claude1 = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
  assert.ok(claude1.startsWith('# Projeto existente\n'));
  assert.ok(claude1.includes('Lanes instaladas: design, arquitetura, auditoria'));

  quiet(() => main(args));
  assert.strictEqual(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8'), claude1);
});

test('installs for Antigravity: adapted agents in .agents/agents and block in AGENTS.md', { skip: !ECC && 'defina ATLAS_ECC_PATH' }, () => {
  const dir = tempProject();
  quiet(() => main(['--target', dir, '--profile', 'web', '--skip-skills', '--ecc-path', ECC]));
  quiet(() => main(['--target', dir, '--profile', 'web', '--skip-skills', '--ecc-path', ECC, '--agent', 'antigravity']));

  const reviewer = fs.readFileSync(path.join(dir, '.agents', 'agents', 'code-reviewer.md'), 'utf8');
  assert.match(reviewer, /^tools: \[view_file, grep_search, find_by_name, run_command\]$/m);
  assert.match(reviewer, /^model: pro$/m);
  const maestro = fs.readFileSync(path.join(dir, '.agents', 'agents', 'maestro.md'), 'utf8');
  assert.match(maestro, /^name: maestro$/m);

  const agentsMd = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
  assert.ok(agentsMd.includes('invoke_subagent'));
  assert.ok(fs.existsSync(path.join(dir, '.claude', 'agents', 'code-reviewer.md')), 'instalação do Claude Code continua lá');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.atlas', 'atlas.json'), 'utf8'));
  assert.deepStrictEqual(manifest.harnesses, ['antigravity', 'claude-code']);
});

test('rejects an unknown harness', () => {
  assert.throws(() => parseArgs(['--agent', 'vim']), /Harness não suportado/);
});

test('skill sources default to pinned GitHub refs and accept overrides', () => {
  const { skillSpec } = require('../scripts/lib/sources');
  const src = { repo: 'Andre-Atlas/ECC', ref: 'abc' };
  assert.strictEqual(skillSpec('ecc', src, {}), 'Andre-Atlas/ECC#abc');
  assert.strictEqual(skillSpec('ecc', src, {}, { ecc: 'v2' }), 'Andre-Atlas/ECC#v2');
  assert.strictEqual(skillSpec('ecc', src, { ecc: '/tmp/ecc' }), path.resolve('/tmp/ecc'));
});
