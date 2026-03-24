# Public Catalog Builder

CLI pequena e offline-first para transformar paginas publicas oficiais da UFBA/SIGAA em snapshot estruturado e versionado.

## O que faz

- Lê `sources.yaml` como lista de fontes públicas.
- Baixa as páginas ao vivo ou usa fixtures locais para execução determinística.
- Registra provenance por página com digest, tamanho e metadados HTTP quando a fonte é viva.
- Extrai estruturas curriculares públicas, candidatos de componentes, guias de horário e faixas de tempo e valida os tokens normalizados antes de escrever.
- Cada estrutura curricular carrega provenance da página de origem, inclusive digest, origem, URL final e instante de captura.
- Escreve um snapshot público em `infra/static-data/public-catalog.snapshot.json` por padrão.

## Estrutura do snapshot

- `pages`: metadados por fonte, com excerpt, códigos detectados e contagens.
- `curriculumStructures`: estruturas curriculares públicas com status, ano de criação e provenance da página de origem.
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
pnpm build
```

Emitir JSON no stdout:

```bash
pnpm build:stdout
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
- Fontes sem `fixture` são tratadas como seeds vivas e entram com provenance HTTP completa no snapshot.
