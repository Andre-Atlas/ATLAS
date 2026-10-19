'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ATLAS_ROOT, loadSources, listModules, listProfiles, loadModule, loadProfile, resolveInstall } = require('../scripts/lib/catalog');

// Local checkouts of the pinned sources. CI sets these; locally they are optional.
const ROOTS = {
  atlas: ATLAS_ROOT,
  ecc: process.env.ATLAS_ECC_PATH,
  superpowers: process.env.ATLAS_SUPERPOWERS_PATH,
  skills: process.env.ATLAS_SKILLS_PATH,
};

function frontmatterName(file) {
  const m = fs.readFileSync(file, 'utf8').match(/^---\n[\s\S]*?^name:\s*(.+)$/m);
  return m && m[1].trim();
}

test('every profile references existing modules and includes core', () => {
  const modules = new Set(listModules());
  for (const name of listProfiles()) {
    const profile = loadProfile(name);
    assert.ok(profile.description, `${name} sem description`);
    assert.ok(profile.modules.includes('core'), `${name} não inclui core`);
    for (const m of profile.modules) assert.ok(modules.has(m), `${name} usa módulo inexistente ${m}`);
  }
});

test('every module only uses declared sources', () => {
  const sources = loadSources();
  for (const name of listModules()) {
    const mod = loadModule(name);
    assert.ok(mod.description, `${name} sem description`);
    for (const src of [...Object.keys(mod.skills || {}), ...Object.keys(mod.agents || {})]) {
      assert.ok(sources[src], `${name} usa fonte não declarada ${src}`);
    }
  }
});

test('external sources are pinned to a full commit sha', () => {
  for (const [name, s] of Object.entries(loadSources())) {
    if (s.self) continue;
    assert.match(s.ref, /^[0-9a-f]{40}$/, `${name} não está fixado num commit`);
  }
});

test('atlas skills and agents have frontmatter matching their names', () => {
  for (const dir of fs.readdirSync(path.join(ATLAS_ROOT, 'skills'))) {
    const file = path.join(ATLAS_ROOT, 'skills', dir, 'SKILL.md');
    assert.strictEqual(frontmatterName(file), dir);
  }
  for (const f of fs.readdirSync(path.join(ATLAS_ROOT, 'agents'))) {
    const text = fs.readFileSync(path.join(ATLAS_ROOT, 'agents', f), 'utf8');
    assert.strictEqual(frontmatterName(path.join(ATLAS_ROOT, 'agents', f)), f.replace(/\.md$/, ''));
    for (const key of ['description:', 'tools:', 'model:']) assert.ok(text.includes(key), `${f} sem ${key}`);
  }
});

test('every referenced skill and agent exists in its source', (t) => {
  for (const name of listModules()) {
    const mod = loadModule(name);
    for (const [src, list] of Object.entries(mod.skills || {})) {
      if (!ROOTS[src]) {
        t.diagnostic(`pulando skills de ${src}: defina ATLAS_${src.toUpperCase()}_PATH`);
        continue;
      }
      for (const s of list) {
        assert.ok(fs.existsSync(path.join(ROOTS[src], 'skills', s, 'SKILL.md')), `${name}: skill ${src}/${s} não existe`);
      }
    }
    for (const [src, list] of Object.entries(mod.agents || {})) {
      if (!ROOTS[src]) continue;
      for (const a of list) {
        assert.ok(fs.existsSync(path.join(ROOTS[src], 'agents', `${a}.md`)), `${name}: agente ${src}/${a} não existe`);
      }
    }
  }
});

test('resolveInstall merges modules without duplicates and always adds core', () => {
  const r = resolveInstall('minimal', ['lane-audit', 'lane-design']);
  assert.deepStrictEqual(r.modules, ['core', 'lane-audit', 'lane-design']);
  assert.deepStrictEqual(r.lanes, ['auditoria', 'design']);
  const ecc = r.skills.ecc;
  assert.strictEqual(new Set(ecc).size, ecc.length);
  assert.ok(ecc.includes('click-path-audit'));
  assert.ok(r.agents.atlas.includes('maestro'));
  assert.deepStrictEqual(r.skills.skills, ['find-skills']);
  assert.ok(ecc.includes('skill-scout'));
});

test('unknown profile or module fails with the available names', () => {
  assert.throws(() => resolveInstall('nao-existe'), /Perfil desconhecido.*minimal/);
  assert.throws(() => resolveInstall('minimal', ['nao-existe']), /Módulo desconhecido.*core/);
});
