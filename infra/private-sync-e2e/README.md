# Private Sync E2E

Ferramenta local e isolada para login autenticado no SIGAA e captura de fixtures sanitizadas.
Tambem valida o fluxo completo `web -> extensao -> SIGAA -> vault local` sem persistir credenciais.

## Objetivo

- Ler `SIGAA_USERNAME` e `SIGAA_PASSWORD` apenas em runtime.
- Fazer login local com Playwright.
- Capturar a pagina autenticada e salvar somente artefatos sanitizados.
- Evitar qualquer persistencia de segredo, storage state ou cookie exportado.

## Estrutura

- `src/cli.ts`: entrada de linha de comando.
- `src/capture.ts`: orquestra login e captura.
- `src/sigaa.ts`: rotina de autenticacao com seletores de fallback.
- `src/sanitize.ts`: normaliza URL, DOM e metadados.
- `src/web-sync.ts`: valida o sync automatico na PWA com a extensao local.
- `tests/sanitize.test.ts`: testes locais sem browser.

## Como usar

1. Instale dependencias dentro deste diretorio:

```bash
cd infra/private-sync-e2e
pnpm install
```

2. Instale o navegador do Playwright se necessario:

```bash
pnpm exec playwright install chromium
```

3. Exporte as credenciais em runtime ou aponte para o `.env` da raiz:

```bash
export FORMAE_E2E_ENV_FILE=../../.env
```

4. Execute a captura:

```bash
pnpm capture
```

Para depurar com navegador visivel:

```bash
pnpm capture:headed
```

5. Para validar o fluxo completo da PWA com a extensao carregada, suba antes a web local em outro terminal:

```bash
cd /path/to/formae
pnpm --filter @formae/web dev --host localhost --port 4173
```

Depois rode:

```bash
cd infra/private-sync-e2e
pnpm sync:web
```

## Configuracao

Variaveis aceitas:

- `SIGAA_USERNAME`
- `SIGAA_PASSWORD`
- `SIGAA_LOGIN_URL`
- `SIGAA_CAPTURE_URL`
- `SIGAA_CAPTURE_DIR`
- `SIGAA_TIMEOUT_MS`
- `SIGAA_HEADED`
- `FORMAE_E2E_ENV_FILE`
- `FORMAE_WEB_URL`
- `FORMAE_EXTENSION_PATH`

Por padrao, a ferramenta tenta carregar `../../.env`, depois `./.env`, e por ultimo `./.env.local`, sem sobrescrever variaveis ja presentes no ambiente.

## Saidas

Os artefatos vao para `artifacts/<timestamp>/` e incluem:

- `metadata.json`
- `page.html`
- `page.txt`
- `network.json`
- `page.summary.json`

Somente o DOM sanitizado e os metadados saneados sao persistidos.
No modo `sync:web`, nada privado e persistido pelo harness: ele apenas imprime um resumo local do teste.

## Estado validado localmente

- `capture --capture-target classes`: validado contra `Minhas Turmas`
- `capture --capture-target grades`: validado contra `Minhas Notas`
- `web-sync`: validado de ponta a ponta contra a PWA local com a extensao MV3 unpacked
- `history`: o atalho autenticado atual abre um fluxo diferente (`gerarHistorico`) e ainda nao entrou como fonte estavel do v1

## Observacoes de seguranca

- Nao grave `storageState`, cookie jar ou trace bruto por padrao.
- Nao comite `artifacts/`.
- Nao execute a ferramenta em computadores compartilhados sem revisar o destino dos arquivos.
