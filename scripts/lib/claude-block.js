'use strict';

const BEGIN = '<!-- ATLAS:BEGIN -->';
const END = '<!-- ATLAS:END -->';

function renderBlock(manifest) {
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
