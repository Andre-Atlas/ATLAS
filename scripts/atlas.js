#!/usr/bin/env node
'use strict';

/**
 * CLI do ATLAS no estilo do skills.sh. Roda sem clonar:
 *
 *   npx github:Andre-Atlas/ATLAS init --profile web --agent antigravity
 *   npx github:Andre-Atlas/ATLAS add lane-audit
 *   npx github:Andre-Atlas/ATLAS list
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');
const { spawnSync } = require('child_process');
const { parseArgs, install } = require('./atlas-install');
const { listProfiles, listModules, loadModule, loadProfile, resolveInstall } = require('./lib/catalog');
const { HARNESSES, getHarness } = require('./lib/harness');
const { SKILLS_CLI } = require('./lib/sources');
const { readManifest, detectHarnesses, planModules, dropped } = require('./lib/project');

const USAGE = `ATLAS: orquestração de agentes para projetos de software

  npx github:Andre-Atlas/ATLAS init [--profile <perfil>] [--agent <a,b>]   instala no projeto atual
  npx github:Andre-Atlas/ATLAS add <módulo...>                             adiciona módulos
  npx github:Andre-Atlas/ATLAS remove <módulo...>                          remove módulos
  npx github:Andre-Atlas/ATLAS update                                      reinstala nas versões fixadas
  npx github:Andre-Atlas/ATLAS list                                        mostra o instalado e o catálogo

Com -g/--global, qualquer comando age na pasta home (~/.claude, ~/.gemini) e o
ATLAS passa a valer em todos os projetos. Uma instalação no projeto vale no lugar dela.

Opções: --target <dir>, -g/--global, -y/--yes (sem perguntas), --dry-run, --with <mód,...>,
        --atlas-ref, --atlas-path, --ecc-path, --superpowers-path, --skip-skills
Agentes: ${Object.keys(HARNESSES).join(', ')} (sem --agent, detecta pelo projeto e pela pasta home)
Perfis: ${listProfiles().join(', ')}`;

/** Split argv into command, positional names, the flags this CLI owns and the rest for the installer. */
function parseCli(argv) {
  const out = { command: argv[0] || 'help', names: [], agents: null, yes: false, profile: null, rest: [] };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-y' || a === '--yes') out.yes = true;
    else if (a === '--agent' || a === '-a') out.agents = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--profile') out.profile = argv[++i];
    else if (a.startsWith('-')) {
      out.rest.push(a);
      if (!['--dry-run', '--skip-skills', '--global', '-g'].includes(a)) out.rest.push(argv[++i]);
    } else out.names.push(a);
  }
  if (out.agents) out.agents.forEach(getHarness);
  return out;
}

async function ask(question, fallback) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${question} [${fallback}] `)).trim();
    return answer || fallback;
  } finally {
    rl.close();
  }
}

function runInstall(cli, agents, profile, withModules) {
  for (const agent of agents) {
    const opts = parseArgs(['--agent', agent, '--profile', profile, ...cli.rest]);
    if (withModules.length) opts.with = [...new Set([...opts.with, ...withModules])];
    install(opts);
  }
}

async function init(cli) {
  const target = parseArgs(cli.rest).target;
  const interactive = !cli.yes && process.stdin.isTTY;
  let profile = cli.profile || 'minimal';
  let agents = cli.agents || detectHarnesses(target);
  if (!agents.length) agents = ['claude-code'];
  if (interactive && !cli.profile) profile = await ask(`Perfil (${listProfiles().join(', ')})?`, 'web');
  if (interactive && !cli.agents) {
    agents = (await ask('Instalar para quais agentes?', agents.join(','))).split(',').map((s) => s.trim());
  }
  loadProfile(profile);
  agents.forEach(getHarness);
  runInstall(cli, agents, profile, []);
}

function requireManifest(cli) {
  const { target, global } = parseArgs(cli.rest);
  const manifest = readManifest(target);
  if (!manifest) throw new Error(`ATLAS não está instalado em ${target}. Rode \`init${global ? ' --global' : ''}\` primeiro.`);
  return { target, global: !!global, manifest, agents: cli.agents || manifest.harnesses || ['claude-code'] };
}

function change(cli, kind) {
  if (!cli.names.length) throw new Error(`Diga quais módulos: ${kind} <módulo...>`);
  cli.names.forEach((m) => loadModule(m));
  const { target, global, manifest, agents } = requireManifest(cli);
  const plan = planModules(manifest, kind === 'add' ? { add: cli.names } : { remove: cli.names });
  if (kind === 'remove') {
    const gone = dropped(manifest, resolveInstall(plan.profile, plan.with));
    const dryRun = cli.rest.includes('--dry-run');
    for (const agent of agents) {
      const harness = getHarness(agent, { global });
      for (const { name } of gone.agents) {
        const file = path.join(target, ...harness.agentsDir, `${name}.md`);
        if (dryRun) process.stdout.write(`[atlas] removeria ${path.relative(target, file)}\n`);
        else fs.rmSync(file, { force: true });
      }
      const skills = gone.skills.map((s) => s.name);
      if (!skills.length || cli.rest.includes('--skip-skills')) continue;
      const args = ['-y', SKILLS_CLI, 'remove', ...skills, '--agent', agent, '-y', ...(global ? ['--global'] : [])];
      process.stdout.write(`[atlas] ${dryRun ? 'removeria' : 'removendo'} skills (${agent}): ${skills.join(', ')}\n`);
      if (dryRun) continue;
      const res = spawnSync('npx', args, { cwd: target, stdio: 'inherit' });
      if (res.status !== 0) throw new Error(`Falha ao remover skills (código ${res.status})`);
    }
    cli.rest.push('--skip-skills');
  }
  runInstall(cli, agents, plan.profile, plan.with);
}

function update(cli) {
  const { manifest, agents } = requireManifest(cli);
  runInstall(cli, agents, manifest.profile, manifest.modules.filter((m) => m !== 'core'));
}

function list(cli) {
  const manifest = readManifest(parseArgs(cli.rest).target);
  const lines = [];
  if (manifest) {
    lines.push(`Instalado: perfil ${manifest.profile} · agentes ${(manifest.harnesses || ['claude-code']).join(', ')}`);
    lines.push(`Lanes: ${manifest.lanes.join(', ') || 'nenhuma'} · stacks: ${manifest.stacks.join(', ') || 'nenhuma'}`, '');
  } else {
    lines.push('ATLAS não está instalado neste projeto.', '');
  }
  lines.push('Módulos:');
  for (const m of listModules()) {
    const mark = manifest && manifest.modules.includes(m) ? '●' : '○';
    lines.push(`  ${mark} ${m.padEnd(18)} ${loadModule(m).description}`);
  }
  lines.push('', 'Perfis:');
  for (const p of listProfiles()) lines.push(`  ${p.padEnd(10)} ${loadProfile(p).modules.join(', ')}`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

async function main(argv) {
  const cli = parseCli(argv);
  if (cli.command === 'init') await init(cli);
  else if (cli.command === 'add' || cli.command === 'remove') change(cli, cli.command);
  else if (cli.command === 'update') update(cli);
  else if (cli.command === 'list' || cli.command === 'ls') list(cli);
  else if (['help', '--help', '-h'].includes(cli.command)) process.stdout.write(`${USAGE}\n`);
  else throw new Error(`Comando desconhecido: ${cli.command}\n\n${USAGE}`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`[atlas] erro: ${err.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main, parseCli };
