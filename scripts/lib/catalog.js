'use strict';

const fs = require('fs');
const path = require('path');

const ATLAS_ROOT = path.resolve(__dirname, '..', '..');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadSources(root = ATLAS_ROOT) {
  return readJson(path.join(root, 'catalog', 'sources.json'));
}

function listNames(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
}

function listModules(root = ATLAS_ROOT) {
  return listNames(path.join(root, 'catalog', 'modules'));
}

function listProfiles(root = ATLAS_ROOT) {
  return listNames(path.join(root, 'profiles'));
}

function loadModule(name, root = ATLAS_ROOT) {
  const file = path.join(root, 'catalog', 'modules', `${name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Módulo desconhecido: ${name}. Disponíveis: ${listModules(root).join(', ')}`);
  }
  return readJson(file);
}

function loadProfile(name, root = ATLAS_ROOT) {
  const file = path.join(root, 'profiles', `${name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Perfil desconhecido: ${name}. Disponíveis: ${listProfiles(root).join(', ')}`);
  }
  return readJson(file);
}

function mergeInto(target, groups) {
  for (const [source, names] of Object.entries(groups || {})) {
    const current = new Set(target[source] || []);
    for (const n of names) current.add(n);
    target[source] = [...current].sort();
  }
}

/**
 * Resolve a profile plus extra modules into one deduplicated install set.
 * `core` is always included, even when a profile forgets it.
 */
function resolveInstall(profileName, extraModules = [], root = ATLAS_ROOT) {
  const profile = loadProfile(profileName, root);
  const modules = [...new Set(['core', ...profile.modules, ...extraModules])];
  const resolved = { profile: profileName, modules, lanes: [], stacks: [], skills: {}, agents: {} };

  for (const name of modules) {
    const mod = loadModule(name, root);
    if (mod.lane) resolved.lanes.push(mod.lane);
    if (mod.stack) resolved.stacks.push(mod.stack);
    mergeInto(resolved.skills, mod.skills);
    mergeInto(resolved.agents, mod.agents);
  }
  return resolved;
}

module.exports = {
  ATLAS_ROOT,
  loadSources,
  listModules,
  listProfiles,
  loadModule,
  loadProfile,
  resolveInstall,
};
