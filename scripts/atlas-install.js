#!/usr/bin/env node
'use strict';

/**
 * Instala o ATLAS num projeto: skills (via CLI `skills`), agentes em
 * .claude/agents, manifesto em .atlas/atlas.json e o bloco do CLAUDE.md.
 *
 *   node scripts/atlas-install.js --target ../meu-projeto --profile web
 *   node scripts/atlas-install.js --target . --profile minimal --with lane-audit --dry-run
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ATLAS_ROOT, loadSources, listProfiles, listModules, resolveInstall } = require('./lib/catalog');
const { renderBlock, upsertBlock } = require('./lib/claude-block');
const { skillSpec, skillsAddArgs, agentRoot } = require('./lib/sources');

const USAGE = `Uso: atlas-install --target <dir> [--profile <nome>] [--with <mod1,mod2>]
                     [--agent claude-code] [--atlas-ref <ref>]
                     [--atlas-path <dir>] [--ecc-path <dir>] [--superpowers-path <dir>]
                     [--skip-skills] [--dry-run]

Por padrão as skills vêm do GitHub nos commits fixados em catalog/sources.json
(ATLAS em \`main\`). Os --*-path usam uma cópia local, útil para desenvolver o ATLAS.

Perfis: ${listProfiles().join(', ')}
Módulos: ${listModules().join(', ')}`;

function parseArgs(argv) {
  const opts = { target: process.cwd(), profile: 'minimal', with: [], agent: 'claude-code', overrides: {}, refs: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Falta valor para ${a}`);
      return argv[++i];
    };
    if (a === '--target') opts.target = next();
    else if (a === '--profile') opts.profile = next();
    else if (a === '--with') opts.with = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--agent') opts.agent = next();
    else if (a === '--atlas-ref') opts.refs.atlas = next();
    else if (a === '--atlas-path') opts.overrides.atlas = next();
    else if (a === '--ecc-path') opts.overrides.ecc = next();
    else if (a === '--superpowers-path') opts.overrides.superpowers = next();
    else if (a === '--skip-skills') opts.skipSkills = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`Opção desconhecida: ${a}`);
  }
  opts.target = path.resolve(opts.target);
  return opts;
}

function log(msg) {
  process.stdout.write(`[atlas] ${msg}\n`);
}

function installSkills(resolved, sources, opts) {
  for (const [name, skills] of Object.entries(resolved.skills)) {
    const spec = skillSpec(name, sources[name], opts.overrides, opts.refs);
    const args = skillsAddArgs(spec, skills, opts.agent);
    log(`skills de ${name}: ${skills.length}`);
    if (opts.dryRun) {
      log(`  npx ${args.join(' ')}`);
      continue;
    }
    const res = spawnSync('npx', args, { cwd: opts.target, stdio: 'inherit' });
    if (res.status !== 0) throw new Error(`Falha ao instalar skills de ${name} (código ${res.status})`);
  }
}

function installAgents(resolved, sources, opts) {
  const dest = path.join(opts.target, '.claude', 'agents');
  const cache = {};
  const installed = [];
  for (const [name, agents] of Object.entries(resolved.agents)) {
    if (opts.dryRun) {
      log(`agentes de ${name}: ${agents.join(', ')}`);
      continue;
    }
    const root = agentRoot(name, sources[name], opts.overrides, ATLAS_ROOT, cache);
    const dir = path.join(root, sources[name].agentsDir || 'agents');
    fs.mkdirSync(dest, { recursive: true });
    for (const a of agents) {
      const from = path.join(dir, `${a}.md`);
      if (!fs.existsSync(from)) throw new Error(`Agente ${a} não existe em ${name} (${from})`);
      fs.copyFileSync(from, path.join(dest, `${a}.md`));
      installed.push(`${name}:${a}`);
    }
  }
  for (const dir of Object.values(cache)) fs.rmSync(dir, { recursive: true, force: true });
  return installed;
}

function writeManifest(resolved, sources, opts) {
  const pinned = {};
  for (const [name, s] of Object.entries(sources)) {
    pinned[name] = opts.overrides[name] ? { repo: s.repo, local: true } : { repo: s.repo, ref: opts.refs[name] || s.ref };
  }
  const manifest = {
    version: 1,
    profile: resolved.profile,
    modules: resolved.modules,
    lanes: resolved.lanes,
    stacks: resolved.stacks,
    sources: pinned,
    skills: resolved.skills,
    agents: resolved.agents,
  };
  if (opts.dryRun) return manifest;
  const dir = path.join(opts.target, '.atlas');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'atlas.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function writeClaudeBlock(manifest, opts) {
  const file = path.join(opts.target, 'CLAUDE.md');
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const next = upsertBlock(current, renderBlock(manifest));
  if (opts.dryRun) {
    log(`CLAUDE.md: bloco ATLAS ${current.includes('ATLAS:BEGIN') ? 'atualizado' : 'adicionado'}`);
    return;
  }
  fs.writeFileSync(file, next);
}

function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (!fs.existsSync(opts.target)) throw new Error(`Diretório alvo não existe: ${opts.target}`);

  const sources = loadSources();
  const resolved = resolveInstall(opts.profile, opts.with);
  log(`perfil ${resolved.profile} · módulos: ${resolved.modules.join(', ')}${opts.dryRun ? ' · simulação' : ''}`);

  if (!opts.skipSkills) installSkills(resolved, sources, opts);
  installAgents(resolved, sources, opts);
  const manifest = writeManifest(resolved, sources, opts);
  writeClaudeBlock(manifest, opts);
  log(opts.dryRun ? 'simulação concluída, nada foi escrito' : `pronto em ${opts.target}`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`[atlas] erro: ${err.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { main, parseArgs };
