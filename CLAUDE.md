# CLAUDE.md

Guia para agentes que trabalham **neste** repositório (o ATLAS em si). Para usar o ATLAS num projeto, veja o README.

## O que é

Camada de orquestração sobre superpowers e ECC. Este repositório só contém o que é próprio do ATLAS: o skill `atlas-maestro`, as lanes, três agentes, o catálogo de módulos, os perfis e o instalador.

## Regras

- **Nunca copie nem edite conteúdo do ECC ou do superpowers aqui.** Referencie por nome em `catalog/modules/*.json`. Para mudar o comportamento de um skill de terceiros, crie um skill próprio com outro nome.
- Fontes externas ficam fixadas num commit completo em `catalog/sources.json`.
- Skills: pasta `skills/<nome>/SKILL.md`, frontmatter com `name` igual ao nome da pasta e `description`; seções Quando usar, Como funciona, Exemplos.
- Agentes: `agents/<nome>.md` com frontmatter `name`, `description`, `tools`, `model`.
- Conteúdo de skills e agentes em português; identificadores, nomes de arquivos e código em inglês, minúsculas com hífen.
- Scripts em Node CommonJS sem dependências externas.

## Testes

```bash
npm test
ATLAS_ECC_PATH=../ECC ATLAS_SUPERPOWERS_PATH=../superpowers npm test   # valida referências
```

Rode os dois antes de commitar. Commits no formato convencional (`feat:`, `fix:`, `docs:`…).
