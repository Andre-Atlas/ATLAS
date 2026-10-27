# ATLAS

Infraestrutura de orquestração de agentes e skills para desenvolver outros projetos de software. O ATLAS não substitui o [superpowers](https://github.com/Andre-Atlas/superpowers) nem o [ECC](https://github.com/Andre-Atlas/ECC): usa os dois como bibliotecas somente leitura, em commits fixados, e acrescenta só o que falta para reger o trabalho.

- **superpowers** é a espinha do fluxo: descoberta, plano, execução com subagentes, verificação, finalização.
- **ECC** é o catálogo de especialistas: agentes e skills por paradigma e por linguagem.
- **ATLAS** é a regência: o `atlas-maestro` classifica cada pedido, escolhe as fases e as lanes, monta o time e guarda os dois gates humanos.

A arquitetura completa e as decisões tomadas estão em [docs/arquitetura.md](docs/arquitetura.md).

## Instalar num projeto

Requer Node 18+ e git. Na pasta do projeto, sem clonar o ATLAS:

```bash
npx github:Andre-Atlas/ATLAS init                      # pergunta o perfil e os agentes
npx github:Andre-Atlas/ATLAS init --profile web --agent claude-code,antigravity -y
npx github:Andre-Atlas/ATLAS add lane-audit stack-node # adiciona módulos
npx github:Andre-Atlas/ATLAS remove lane-audit         # remove módulos (skills e agentes)
npx github:Andre-Atlas/ATLAS update                    # reinstala nas versões fixadas
npx github:Andre-Atlas/ATLAS list                      # instalado e catálogo
```

Sem `--agent`, o `init` detecta os agentes pelo projeto (`.claude/`, `CLAUDE.md`, `.agents/agents/`) e depois pela pasta home (`~/.claude`, `~/.gemini/antigravity`). Os outros comandos usam os agentes gravados no manifesto. Todos aceitam `--target <dir>` e `--dry-run`.

### Instalação global (todos os projetos)

```bash
npx github:Andre-Atlas/ATLAS init --global --profile web --agent claude-code,antigravity
```

Com `-g`/`--global` o ATLAS vai para a pasta home e passa a valer em qualquer projeto aberto no Claude Code ou no Antigravity, sem instalar nada no repositório:

| | Claude Code | Antigravity |
|---|---|---|
| Skills | `~/.claude/skills/` | `~/.gemini/antigravity/skills/` |
| Agentes | `~/.claude/agents/` | `~/.gemini/config/agents/` |
| Bloco ATLAS | `~/.claude/CLAUDE.md` | `~/.gemini/AGENTS.md` |
| Manifesto | `~/.atlas/atlas.json` | `~/.atlas/atlas.json` |

`add`, `remove`, `update` e `list` aceitam `--global` do mesmo jeito. Um projeto com instalação própria (`.atlas/atlas.json`) usa a dele no lugar da global, o que serve para fixar um perfil diferente por projeto. Os artefatos de trabalho (spec, plano, ledger) continuam em `docs/atlas/` de cada projeto.

A instalação global vale para o Claude Code (terminal, desktop e IDE). O chat do claude.ai não tem subagentes nem lê `~/.claude`, então o fluxo do ATLAS não roda lá.

O mesmo fluxo existe como script, a partir de um clone do ATLAS:

```bash
node scripts/atlas-install.js --target ../meu-projeto --profile web
```

O instalador:

1. instala as skills do perfil no projeto com o CLI [`skills`](https://github.com/Andre-Atlas/skills), gerando `skills-lock.json` com as versões exatas;
2. copia os agentes para `.claude/agents/`;
3. grava o manifesto `.atlas/atlas.json` (perfil, lanes, stacks, fontes, harnesses);
4. adiciona ao `CLAUDE.md` do projeto um bloco entre `<!-- ATLAS:BEGIN -->` e `<!-- ATLAS:END -->`, sem tocar no resto do arquivo.

Rodar de novo atualiza tudo no lugar. Use `--dry-run` para ver o que seria feito.

### Google Antigravity

```bash
npx github:Andre-Atlas/ATLAS init --profile web --agent antigravity
```

Com `--agent antigravity` (ou `antigravity-cli`) as skills vão para `.agents/skills/`, os agentes para `.agents/agents/` com as ferramentas e o modelo traduzidos, e o bloco ATLAS para o `AGENTS.md`. O guia completo, com o mapa de conceitos e a configuração dos gates, está em [docs/antigravity.md](docs/antigravity.md).

### Perfis

| Perfil | Módulos |
|---|---|
| `minimal` | núcleo |
| `web` | núcleo + Design + Arquitetura + Auditoria + React |
| `fullstack` | `web` + backend Node |
| `backend` | núcleo + Arquitetura + Auditoria + Node |
| `python` | núcleo + Arquitetura + Auditoria + Python |

Some módulos extras com `--with lane-audit,stack-node`. Os módulos estão em [catalog/modules](catalog/modules).

## Como o fluxo funciona no projeto

Todo pedido começa com o maestro declarando uma linha:

```
ATLAS · feature · design+arquitetura · standard → pesquisa, descoberta, plano, G1, SDD, revisão, verificação, G2 · lanes: design, arquitetura
```

A partir daí rodam só as fases do tamanho declarado. Há dois gates: **Gate 1** (aprovar spec e plano) e **Gate 2** (aprovar a integração). Entre eles o trabalho segue sem perguntas, e cada decisão tomada fica registrada no ledger. Detalhes em [skills/atlas-maestro/SKILL.md](skills/atlas-maestro/SKILL.md).

## O que o ATLAS contém

| Caminho | Conteúdo |
|---|---|
| `skills/atlas-maestro` | regência: classificação, fases, gates, precedência entre superpowers e ECC |
| `skills/atlas-lane-*` | lanes Design, Arquitetura e Auditoria |
| `agents/` | `maestro` (classificador), `design-director`, `audit-lead` |
| `catalog/sources.json` | fontes e commits fixados |
| `catalog/modules/` | o que cada módulo instala |
| `profiles/` | combinações de módulos |
| `scripts/atlas-install.js` | instalador |

## Atualizar ECC ou superpowers

1. Sincronize o fork com o upstream no GitHub.
2. Troque o `ref` em `catalog/sources.json` pelo novo commit.
3. Rode os testes com as cópias locais (abaixo). Se algum skill ou agente referenciado sumiu ou mudou de nome, o teste aponta.
4. Rode o instalador de novo nos projetos.

### Skills fora do catálogo

Quando um projeto precisa de algo que nenhum módulo cobre, o `atlas-maestro` segue esta ordem: módulo do catálogo, depois `find-skills` (busca no ecossistema com `npx skills find`), e só então `skill-scout` antes de criar um skill novo. Instalar um skill de fora sempre pede aprovação, e o que se repetir em dois projetos vira módulo do ATLAS.

Quando um skill de terceiros não serve como está, crie um skill com nome próprio em `skills/` que o envolva ou substitua e troque a referência no módulo. Nunca edite o original.

## Desenvolvimento

```bash
npm test
# validação completa das referências contra as fontes fixadas:
ATLAS_ECC_PATH=../ECC ATLAS_SUPERPOWERS_PATH=../superpowers ATLAS_SKILLS_PATH=../skills npm test
```

Para testar mudanças locais do ATLAS num projeto antes do push, use `--atlas-path .`.
