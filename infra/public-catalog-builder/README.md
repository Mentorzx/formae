# Public Catalog Builder

Builder manual/offline para snapshots publicos da UFBA.

## Objetivo

- Baixar somente paginas publicas do SIGAA, UFBA SIM e SUPAC
- Normalizar para JSON versionado
- Nunca tocar em credenciais ou dados privados de estudantes

## Saidas esperadas

- `infra/static-data/catalog-index.json`
- snapshots por fonte publica
- metadados de captura e versionamento

## Operacao inicial

- Rodar apenas manualmente no v0
- Validar HTML contra fixtures publicas antes de publicar
- Publicar saida estavel como artefato estatico

