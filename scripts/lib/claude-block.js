'use strict';

const BEGIN = '<!-- ATLAS:BEGIN -->';
const END = '<!-- ATLAS:END -->';

// Extra lines for harnesses whose tools differ from Claude Code's.
const HARNESS_NOTES = {
  antigravity: [
    '',
    'No Antigravity: delegar a um agente é `invoke_subagent` com o nome do agente de',
    '`.agents/agents/`; a lista de tarefas é um artefato do tipo task. A tradução completa',
    'das ferramentas citadas pelos skills está em `references/antigravity.md`, dentro do',
    'skill `atlas-maestro`. Os dois gates continuam valendo: pare e peça aprovação.',
  ],
};
HARNESS_NOTES['antigravity-cli'] = HARNESS_NOTES.antigravity;

function renderBlock(manifest, harness = 'claude-code') {
  const lanes = manifest.lanes.length ? manifest.lanes.join(', ') : 'nenhuma (só o núcleo)';
  const stacks = manifest.stacks.length ? manifest.stacks.join(', ') : 'nenhuma';
  return [
    BEGIN,
    '## ATLAS: orquestração de agentes',
    '',
    'Este projeto usa o ATLAS. Em todo pedido que vá produzir ou alterar código, design,',
    'arquitetura ou um relatório de auditoria, carregue primeiro o skill `atlas-maestro`',
    'e siga o fluxo dele: declarar a linha de classificação, rodar as fases do tamanho',
    'declarado e respeitar os dois gates (spec + plano, e integração).',
    '',
    `- Perfil: \`${manifest.profile}\``,
    `- Lanes instaladas: ${lanes}`,
    `- Stacks: ${stacks}`,
    '- Manifesto completo: `.atlas/atlas.json`',
    '- Artefatos de trabalho (spec, plano, ledger, revisões): `docs/atlas/`',
    ...(HARNESS_NOTES[harness] || []),
    '',
    'Este bloco é gerado pelo instalador do ATLAS. Edite fora dos marcadores.',
    END,
  ].join('\n');
}

/** Insert or replace the ATLAS block, leaving the rest of the file untouched. */
function upsertBlock(existing, block) {
  const text = existing || '';
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  if (start !== -1 && end > start) {
    return text.slice(0, start) + block + text.slice(end + END.length);
  }
  if (!text.trim()) return `${block}\n`;
  const sep = text.endsWith('\n') ? '\n' : '\n\n';
  return `${text}${sep}${block}\n`;
}

module.exports = { BEGIN, END, renderBlock, upsertBlock };
