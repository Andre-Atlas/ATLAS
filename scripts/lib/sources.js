'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SKILLS_CLI = 'skills@1.7.2';

/**
 * Where each source is read from. A local override (a checkout on disk) wins;
 * otherwise the GitHub ref from catalog/sources.json (or a --*-ref flag) is used.
 */
function skillSpec(name, source, overrides, refs = {}) {
  if (overrides[name]) return path.resolve(overrides[name]);
  return `${source.repo}#${refs[name] || source.ref}`;
}

function skillsAddArgs(spec, skillNames, agent, global = false) {
  const args = ['-y', SKILLS_CLI, 'add', spec];
  for (const s of skillNames) args.push('--skill', s);
  args.push('--agent', agent, '--yes');
  if (global) args.push('--global');
  return args;
}

/** Shallow-fetch one pinned commit into a temp dir and return its path. */
function fetchPinned(source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-src-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'] });
  git('init', '-q');
  git('remote', 'add', 'origin', `https://github.com/${source.repo}.git`);
  git('fetch', '-q', '--depth', '1', 'origin', source.ref);
  git('checkout', '-q', 'FETCH_HEAD');
  return dir;
}

function agentRoot(name, source, overrides, atlasRoot, cache) {
  if (overrides[name]) return path.resolve(overrides[name]);
  if (source.self) return atlasRoot;
  if (!cache[name]) cache[name] = fetchPinned(source);
  return cache[name];
}

module.exports = { SKILLS_CLI, skillSpec, skillsAddArgs, fetchPinned, agentRoot };
