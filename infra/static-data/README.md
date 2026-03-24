# Static Data

Diretorio reservado para snapshots publicos versionados.

- Nenhum dado privado deve ser gravado aqui.
- Saidas do catalog builder precisam ser deterministicas e auditaveis.
- `public-catalog.snapshot.json` e o artefato gerado pelo builder public-first, com provenance de pagina e validacao de tokens publicos.
- O snapshot agora tambem carrega `curriculumStructures` extraidas das paginas publicas de curriculo, para cobrir matriz ativa e historico sem depender de seed manual.
- `catalog-index.json` continua como seed manual do app ate a migracao completa do consumo.
