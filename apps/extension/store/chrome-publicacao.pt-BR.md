# Publicacao da extensao na Chrome Web Store

Este e o passo a passo curto e operacional. Ele existe para que voce consiga
fazer o bootstrap da conta e depois me entregar exatamente os valores que eu
preciso para publicar via API.

## O que sera publicado

O artefato da Chrome Web Store e este arquivo:

- `dist/releases/formae-extension-0.1.0.zip`

Ele e gerado a partir da pasta:

- `apps/extension/`

Se precisar regerar:

```bash
pnpm package:extension
```

## O que ja esta pronto no repo

- pacote `.zip` para Chrome
- script de upload/publish via API: `scripts/publish-chrome-webstore.mjs`
- texto base da listing: `apps/extension/store/chrome-listing.pt-BR.md`
- icones da extensao em `apps/extension/assets/`
- screenshots prontos para a loja em `apps/extension/store/screenshots/`
- pagina publica de privacidade: `https://mentorzx.github.io/formae/#/privacidade`
- pagina publica de suporte: `https://mentorzx.github.io/formae/#/suporte`

As capturas de tela prontas seguem o formato exigido pela Chrome Web Store:

- `1280x800`
- PNG
- sem canal alfa

## O que ainda e manual no primeiro publish

O primeiro bootstrap no dashboard do Chrome continua manual:

1. registrar a conta developer
2. pagar a taxa unica
3. ativar verificacao em duas etapas
4. criar o item no dashboard
5. preencher `Store listing`
6. preencher `Privacy`
7. preencher `Test instructions`

## Como criar os tokens e IDs que eu preciso

### 1. Criar o projeto Google Cloud

- abra o Google Cloud Console
- crie ou selecione um projeto
- habilite a `Chrome Web Store API`

### 2. Criar OAuth consent screen

Preencha:

- `App name`
- `User support email`
- `Developer contact information`

### 3. Criar OAuth client

- tipo: `Web application`
- redirect URI:
  - `https://developers.google.com/oauthplayground`

Ao final voce recebe:

- `CWS_CLIENT_ID`
- `CWS_CLIENT_SECRET`

### 4. Gerar o refresh token

Use o OAuth 2.0 Playground:

1. abra `https://developers.google.com/oauthplayground`
2. clique na engrenagem no canto superior direito
3. marque `Use your own OAuth credentials`
4. cole seu `Client ID` e `Client Secret`
5. no campo de escopos use:

```text
https://www.googleapis.com/auth/chromewebstore
```

6. clique em `Authorize APIs`
7. faça login com a conta publisher
8. clique em `Exchange authorization code for tokens`

Guarde:

- `CWS_REFRESH_TOKEN`

### 5. Criar o item da extensao no dashboard

Depois de criar o item no Chrome Web Store Developer Dashboard, voce precisa me
mandar:

- `CWS_EXTENSION_ID`

### 6. Descobrir o publisher id

Depois do bootstrap do publisher e do item, voce tambem precisa me mandar:

- `CWS_PUBLISHER_ID`

## Os 5 valores que voce precisa me fornecer

Voce pode me passar estes valores via ambiente local ou `.env` local nao
commitado:

```bash
export CWS_CLIENT_ID=...
export CWS_CLIENT_SECRET=...
export CWS_REFRESH_TOKEN=...
export CWS_PUBLISHER_ID=...
export CWS_EXTENSION_ID=...
```

## O que eu faco depois que voce me passar isso

### So fazer upload

```bash
pnpm publish:chrome-webstore
```

### Fazer upload e submeter para review/publicacao

```bash
pnpm publish:chrome-webstore -- --publish
```

## O que voce precisa preencher no dashboard

### Store listing

Use como base:

- `apps/extension/store/chrome-listing.pt-BR.md`

### Privacy

Use como URL publica:

- `https://mentorzx.github.io/formae/#/privacidade`

### Support

Use como URL publica:

- `https://mentorzx.github.io/formae/#/suporte`

### Test instructions

Explique no dashboard:

- que a extensao conversa com a PWA publicada em `https://mentorzx.github.io/formae/#/`
- que o reviewer deve abrir a popup da extensao
- que a popup aceita credenciais efemeras
- que o sync e disparado na rota `#/importacao`
- que o fluxo local depende de acesso ao SIGAA
