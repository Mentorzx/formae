# Static Data

Diretorio reservado para snapshots publicos versionados.

- Nenhum dado privado deve ser gravado aqui.
- Saidas do catalog builder precisam ser deterministicas e auditaveis.
- `public-catalog.snapshot.json` e o artefato gerado pelo builder public-first, com provenance de pagina e validacao de tokens publicos.
- O snapshot agora tambem carrega `curriculumStructures` extraidas das paginas publicas de curriculo, com provenance propria por entrada para cobrir matriz ativa e historico sem depender de seed manual.
- O mesmo snapshot tambem pode carregar `curriculumDetails`, separando secoes, componentes e cargas horarias da matriz publica sem depender de backend.
- `catalog-index.json` continua como seed manual do app ate a migracao completa do consumo.
