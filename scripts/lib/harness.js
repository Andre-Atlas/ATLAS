'use strict';

/**
 * Where each harness reads agents and project instructions, and how an agent
 * written for Claude Code is adapted to it. Skills need no adaptation: the
 * `skills` CLI already knows each harness's skills folder.
 */

// Same mapping the ECC uses for Antigravity (scripts/lib/install/antigravity-agent.js).
// A tool name Antigravity does not know can hang the subagent, so unknown names are dropped.
const ANTIGRAVITY_TOOLS = Object.freeze({
  Read: 'view_file',
  Write: 'write_to_file',
  Edit: 'replace_file_content',
  Grep: 'grep_search',
  Glob: 'find_by_name',
  Bash: 'run_command',
  WebSearch: 'search_web',
  WebFetch: 'read_url_content',
});

const ANTIGRAVITY_MODELS = Object.freeze({ haiku: 'flash', sonnet: 'pro', opus: 'pro' });

function splitFrontmatter(source, label) {
  const match = String(source).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) throw new Error(`Agente ${label} sem frontmatter YAML`);
  return { lines: match[1].split(/\r?\n/), body: source.slice(match[0].length) };
}

/**
 * Rewrite a Claude Code agent for Antigravity. Agent frontmatter in ATLAS and
 * ECC is flat `key: value` lines, so a line-based rewrite is enough and keeps
 * the installer free of a YAML dependency.
 */
function toAntigravityAgent(source, label = '<agente>') {
  const { lines, body } = splitFrontmatter(source, label);
  const out = [];
  for (const line of lines) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) {
      out.push(line);
      continue;
    }
    const [, key, value] = m;
    if (key === 'color') continue;
    if (key === 'tools') {
      const names = value.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
      const tools = [...new Set(names.filter((n) => ANTIGRAVITY_TOOLS[n]).map((n) => ANTIGRAVITY_TOOLS[n]))];
      out.push(`tools: [${tools.join(', ')}]`);
    } else if (key === 'model') {
      out.push(`model: ${ANTIGRAVITY_MODELS[value.trim()] || value.trim()}`);
    } else {
      out.push(line);
    }
  }
  return `---\n${out.join('\n')}\n---\n${body}`;
}

// `global` paths are relative to the user's home folder and apply to every project.
const ANTIGRAVITY = {
  agentsDir: ['.agents', 'agents'],
  instructionsFile: 'AGENTS.md',
  global: { agentsDir: ['.gemini', 'config', 'agents'], instructionsFile: '.gemini/AGENTS.md' },
  adaptAgent: toAntigravityAgent,
};

const HARNESSES = Object.freeze({
  'claude-code': {
    agentsDir: ['.claude', 'agents'],
    instructionsFile: 'CLAUDE.md',
    global: { agentsDir: ['.claude', 'agents'], instructionsFile: '.claude/CLAUDE.md' },
    adaptAgent: (source) => source,
  },
  antigravity: ANTIGRAVITY,
  'antigravity-cli': ANTIGRAVITY,
});

/** The harness with its paths for a project install, or for the home folder when `global` is set. */
function getHarness(name, { global = false } = {}) {
  const h = HARNESSES[name];
  if (!h) throw new Error(`Harness não suportado: ${name}. Suportados: ${Object.keys(HARNESSES).join(', ')}`);
  const paths = global ? h.global : { agentsDir: h.agentsDir, instructionsFile: h.instructionsFile };
  return { name, adaptAgent: h.adaptAgent, global, ...paths };
}

module.exports = { HARNESSES, getHarness, toAntigravityAgent };
