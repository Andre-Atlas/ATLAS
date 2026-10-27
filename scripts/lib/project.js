'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveInstall } = require('./catalog');
const { HARNESSES } = require('./harness');

function readManifest(target) {
  const file = path.join(target, '.atlas', 'atlas.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/**
 * Guess which harnesses to install for, like the `skills` CLI does: what the
 * project already uses first, then what is installed in the user's home.
 * Antigravity app and CLI write the same project files, so only one is kept.
 */
function detectHarnesses(target, home = os.homedir()) {
  const has = (...p) => fs.existsSync(path.join(...p));
  const found = new Set();
  if (has(target, '.claude') || has(target, 'CLAUDE.md')) found.add('claude-code');
  // In the home folder (global install) ~/.gemini is Antigravity's own folder.
  if (has(target, '.gemini', 'antigravity') || has(target, '.gemini', 'config')) found.add('antigravity');
  if (has(target, '.agents', 'agents') || has(target, 'GEMINI.md')) found.add('antigravity');
  if (!found.size) {
    if (has(home, '.claude')) found.add('claude-code');
    if (has(home, '.gemini', 'antigravity') || has(home, '.gemini', 'config')) found.add('antigravity');
    else if (has(home, '.gemini', 'antigravity-cli')) found.add('antigravity-cli');
  }
  return [...found].filter((h) => HARNESSES[h]);
}

/**
 * Work out the profile and extra modules after adding or removing modules.
 * Removing a module that belongs to the profile drops to `minimal` plus the
 * remaining modules, so the result is exactly what is left.
 */
function planModules(manifest, { add = [], remove = [] }) {
  if (remove.includes('core')) throw new Error('O módulo core não pode ser removido');
  const current = manifest.modules || ['core'];
  for (const m of remove) {
    if (!current.includes(m)) throw new Error(`Módulo ${m} não está instalado`);
  }
  const kept = current.filter((m) => !remove.includes(m));
  const modules = [...new Set([...kept, ...add])];
  const profileModules = resolveInstall(manifest.profile).modules;
  const profile = profileModules.every((m) => modules.includes(m)) ? manifest.profile : 'minimal';
  return { profile, with: modules.filter((m) => m !== 'core') };
}

/** Skills and agents present in `before` but gone from `after`, per source. */
function dropped(before, after) {
  const diff = (a, b) => {
    const out = [];
    for (const [src, names] of Object.entries(a)) {
      const keep = new Set(b[src] || []);
      for (const n of names) if (!keep.has(n)) out.push({ source: src, name: n });
    }
    return out;
  };
  return { skills: diff(before.skills, after.skills), agents: diff(before.agents, after.agents) };
}

module.exports = { readManifest, detectHarnesses, planModules, dropped };
