# Public Catalog Builder

CLI pequena e offline-first para transformar paginas publicas oficiais da UFBA/SIGAA em snapshot estruturado e versionado.

## O que faz

- Lê `sources.yaml` como lista de fontes públicas.
- Baixa as páginas ao vivo ou usa fixtures locais para execução determinística.
- Extrai candidatos de componentes, guias de horário e faixas de tempo.
- Escreve um snapshot público em `infra/static-data/public-catalog.snapshot.json` por padrão.

## Estrutura do snapshot

- `pages`: metadados por fonte, com excerpt, códigos detectados e contagens.
- `components`: candidatos públicos descobertos em listagens da SIGAA.
- `scheduleGuide`: referências de códigos de horário e exemplos.
- `timeSlots`: faixas oficiais de horário extraídas da tabela da IHAC.

## Uso

Instalar dependências no diretório:

```bash
cd infra/public-catalog-builder
pnpm install
```

Gerar snapshot usando fixtures locais:

```bash
pnpm build -- --fixtures-dir ../../fixtures/public
```

Emitir JSON no stdout:

```bash
pnpm build:stdout -- --fixtures-dir ../../fixtures/public
```

Executar testes:

```bash
pnpm test
```

## Convenções

- O builder não toca em dados privados de estudantes.
- `schemaVersion` do snapshot sobe quando o formato muda.
- `builderVersion` identifica a implementação que produziu o snapshot.
- Fixtures públicas ficam em `fixtures/public/` e servem como replay test.
