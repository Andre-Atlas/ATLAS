# ATLAS no Google Antigravity

Guia para instalar e usar o ATLAS em projetos abertos no Google Antigravity (app, IDE ou CLI `agy`). O fluxo é o mesmo do Claude Code: o que muda é onde os arquivos ficam e como o agente chama outros agentes.

## 1. O ATLAS em uma página

O ATLAS é uma camada de regência sobre duas bibliotecas que ficam somente leitura:

- **superpowers** dá a espinha do fluxo: descoberta (`brainstorming`), plano (`writing-plans`), execução com subagentes (`subagent-driven-development`), verificação e finalização.
- **ECC** dá os especialistas: agentes revisores, arquitetos e skills por domínio e por linguagem.
- **ATLAS** acrescenta o `atlas-maestro`, que classifica cada pedido, escolhe as fases e as lanes, monta o time e guarda dois gates humanos.

Todo pedido começa com uma linha de classificação:

```
ATLAS · <operação> · <paradigmas> · <tamanho> → <fases> · lanes: <lanes>
```

- **Operação:** `feature`, `change`, `fix`, `refactor`, `mvp`, `audit`, `design`.
- **Tamanho:** `trivial`, `small`, `standard`, `large`. Ele decide quais fases rodam.
- **Gate 1** (a partir de `standard`): aprovar spec e plano antes de qualquer código.
- **Gate 2** (sempre): aprovar o diff antes de push, merge ou deploy.
- **Entre os gates o agente não para para perguntar.** Cada decisão vira uma linha `Ruling:` no ledger.
- **Nada fica só na conversa.** Spec, plano, ledger e revisões são arquivos em `docs/atlas/`.

Os detalhes estão em [skills/atlas-maestro/SKILL.md](../skills/atlas-maestro/SKILL.md) e a arquitetura em [arquitetura.md](arquitetura.md).

## 2. Mapa de conceitos

| ATLAS (pensado no Claude Code) | Antigravity | Como o instalador resolve |
|---|---|---|
| Skills em `.claude/skills/` | Skills em `.agents/skills/<nome>/SKILL.md`, mesmo formato (`name` e `description`), carregadas pela descrição ou com `/<nome>` | CLI `skills` com `--agent antigravity` |
| Agentes em `.claude/agents/` (`tools: Read, Grep…`, `model: opus`) | Agentes customizados em `.agents/agents/<nome>.md` (`tools: [view_file, grep_search…]`, `model: pro`/`flash`/`inherit`) | copia e traduz o frontmatter |
| Bloco ATLAS no `CLAUDE.md` | `AGENTS.md` na raiz, sempre ativo | grava o bloco no `AGENTS.md` |
| `Task` com `subagent_type` | `invoke_subagent` com o nome do agente | instrução no bloco e em `references/antigravity.md` |
| Subagente `general-purpose` / `Explore` | tipos embutidos `self` / `research` | idem |
| Worktree por tarefa (`using-git-worktrees`) | `invoke_subagent` com workspace `branch` | idem |
| `TodoWrite` | artefato do tipo task (checklist em markdown) | idem |
| Gates por conversa | artefatos para revisão + política de execução de comandos | configuração manual (seção 4) |
| Hooks do Claude Code | `.agents/hooks.json` (`PreToolUse`, `Stop`…) | opcional, não instalado |
| Plugin do Claude Code | plugin do Antigravity (`plugin.json` + `skills/`, `agents/`, `rules/`) | não usado: o ATLAS instala por projeto |

Tradução de ferramentas usada nos agentes (a mesma do instalador do ECC):

| Claude Code | Antigravity |
|---|---|
| `Read` | `view_file` |
| `Write` | `write_to_file` |
| `Edit` | `replace_file_content` |
| `Grep` | `grep_search` |
| `Glob` | `find_by_name` |
| `Bash` | `run_command` |
| `WebSearch` | `search_web` |
| `WebFetch` | `read_url_content` |

Ferramentas sem equivalente (por exemplo `Task`) saem da lista, porque um nome que o Antigravity não conhece pode travar o subagente. Modelos: `opus` e `sonnet` viram `pro`, `haiku` vira `flash`.

## 3. Instalar num projeto

Requer Node 18+ e git. Na pasta do ATLAS:

```bash
node scripts/atlas-install.js --target ../meu-projeto --profile web --agent antigravity
```

Use `--agent antigravity-cli` se o projeto for usado só pelo `agy`; o resultado no projeto é o mesmo. `--dry-run` mostra o que seria feito.

O que aparece no projeto:

```
meu-projeto/
├── AGENTS.md              # bloco ATLAS entre <!-- ATLAS:BEGIN --> e <!-- ATLAS:END -->
├── skills-lock.json       # versões exatas das skills
├── .atlas/atlas.json      # perfil, lanes, stacks, fontes e harnesses instalados
└── .agents/
    ├── skills/            # atlas-maestro (com references/antigravity.md), lanes, superpowers, ECC
    └── agents/            # maestro, design-director, audit-lead e os agentes do ECC do perfil
```

O mesmo projeto pode ter as duas instalações. Rode o instalador uma vez com `--agent claude-code` e outra com `--agent antigravity`: cada uma escreve nas pastas do seu harness e `.atlas/atlas.json` lista as duas em `harnesses`.

Os perfis e módulos são os mesmos do Claude Code (veja o [README](../README.md#perfis)).

## 4. Configurar o Antigravity para os gates

O ATLAS depende de o agente parar em dois momentos. No Antigravity isso se apoia em três ajustes. Os nomes exatos das opções mudam entre versões; procure pelos equivalentes nas configurações do agente.

1. **Modo de planejamento ligado** para conversas ATLAS. Assim o agente produz o plano como artefato antes de executar, o que casa com o Gate 1.
2. **Revisão de artefatos pedindo sua aprovação** (não "sempre seguir"). Você aprova ou comenta a spec e o plano direto no artefato.
3. **Execução de comandos sem auto-aprovação total.** Subagentes herdam a política da conversa principal. Se tudo for aprovado sozinho, nada segura um `git push` antes do Gate 2.

**Opcional: hook para o Gate 2.** O Antigravity lê hooks de `.agents/hooks.json`. Um hook `PreToolUse` com `matcher: "run_command"` pode devolver `{"decision": "ask"}` quando o comando for `git push`, `git merge`, `gh pr merge` ou um deploy, forçando a confirmação mesmo com auto-aprovação ligada. O ATLAS ainda não instala esse hook porque o formato da entrada no stdin precisa ser confirmado na versão do Antigravity em uso.

## 5. Uso no dia a dia

Abra o projeto e faça o pedido normalmente. O `AGENTS.md` instrui o agente a carregar o `atlas-maestro` primeiro. Para garantir, comece com `/atlas-maestro` ou cite o skill no pedido.

### O que esperar em cada tamanho

| Tamanho | O agente faz | Você faz |
|---|---|---|
| `trivial` | edita, roda testes, chama `code-reviewer` | aprova o Gate 2 |
| `small` | pesquisa leve, plano inline, `executing-plans`, revisão | aprova o Gate 2 |
| `standard` | pesquisa, `brainstorming`, `writing-plans` com tags de lane | aprova o **Gate 1** (spec + plano) |
| | SDD: um `invoke_subagent` por tarefa, revisores por tag de lane | nada; acompanhe no painel `/agents` |
| | verificação e resumo | aprova o **Gate 2** |
| `large` | igual a `standard`, com `council`/`dev-team`, ADR e tarefas em worktrees (`branch`) | Gate 1 e Gate 2 |

### Pedidos de exemplo

Feature com interface e arquitetura:

```
/atlas-maestro Quero uma página de assinatura com três planos e checkout pelo Stripe.
```

Resposta esperada na primeira linha:

```
ATLAS · feature · design+arquitetura · standard → pesquisa, descoberta, plano, G1, SDD, revisão, verificação, G2 · lanes: design, arquitetura
```

Correção pequena:

```
O total do carrinho fica errado quando o cupom é de 100%. Corrija.
```

```
ATLAS · fix · core · small → pesquisa leve, executing-plans, revisão, verificação, G2 · lanes: —
```

Auditoria sem código:

```
/atlas-maestro Audite o módulo de pagamentos antes do lançamento.
```

O agente abre um `invoke_subagent` por dimensão em paralelo (produção, segurança, falhas silenciosas, performance), entrega os achados ao `audit-lead` e salva o relatório em `docs/atlas/auditorias/`.

### Tags de lane e quem é chamado

| Tag no plano | Implementa (`invoke_subagent`) | Revisa (`invoke_subagent`) |
|---|---|---|
| `[core]` | `self` com `test-driven-development`, ou `tdd-guide` | `code-reviewer` + revisor da linguagem |
| `[design]` | `self` com `atlas-lane-design` | `design-director` + `a11y-architect` |
| `[arch]` | `self` com `atlas-lane-architecture` | `architect` + `type-design-analyzer` |
| `[audit]` | — | `audit-lead` |
| `[data]` | `self` | `database-reviewer` |

`security-reviewer` entra sempre que o diff toca autenticação, entrada do usuário, banco, arquivos, APIs externas, criptografia ou segredos.

### Retomar um trabalho

Subagentes do Antigravity começam sem o histórico da conversa, e conversas novas também. Por isso tudo fica em `docs/atlas/<data>-<slug>/` (spec, plano, ledger, revisões). Para retomar:

```
/atlas-maestro Retome o trabalho de docs/atlas/2026-10-27-assinaturas/ a partir do ledger.
```

## 6. Diferenças e limites conhecidos

- **Os skills do superpowers e do ECC citam ferramentas do Claude Code.** O agente traduz usando `references/antigravity.md` (instalado dentro do `atlas-maestro`). Se ele tentar chamar `Task` ou `TodoWrite`, lembre-o desse arquivo.
- **A regência fica na conversa principal.** O Antigravity permite subagentes aninhados, mas só a conversa principal declara a linha ATLAS, guarda os gates e escreve no ledger.
- **`/boost` e `/teamwork-preview`** são orquestradores do próprio Antigravity. Não use dentro de um trabalho ATLAS: eles não respeitam os gates nem o ledger.
- **Workflows (`.agents/workflows/`)** estão sendo trocados por skills no Antigravity. O ATLAS não usa workflows; `/atlas-maestro` e `/<lane>` já funcionam como comandos.
- **Regras modulares (`.agents/rules/`)** não são necessárias. Se o `AGENTS.md` do projeto ficar grande demais, mova regras do projeto (não o bloco ATLAS) para `.agents/rules/*.md` com `trigger: model_decision`.
- **Hooks do ECC** não são instalados no Antigravity.

## 7. Manutenção

- Atualizar ECC ou superpowers: troque o `ref` em `catalog/sources.json`, rode os testes e reinstale com o mesmo comando.
- Instalar um skill de fora num projeto: `npx skills add <fonte> --skill <nome> --agent antigravity --yes`, sempre depois de aprovar (é um gate, ver `atlas-maestro`).
- Reinstalar atualiza tudo no lugar. O bloco do `AGENTS.md` é substituído sem tocar no resto do arquivo.

## Referências

- Antigravity: [skills](https://antigravity.google/docs/skills/), [subagentes e agentes customizados](https://antigravity.google/docs/subagents), [regras e AGENTS.md](https://antigravity.google/docs/rules/), [hooks](https://antigravity.google/docs/hooks/), [plugins](https://antigravity.google/docs/plugins?tab=cli).
- Tradução de ferramentas do ECC: `scripts/lib/install/antigravity-agent.js` no ECC.
- Mapeamento do superpowers: `skills/using-superpowers/references/antigravity-tools.md` no superpowers.
