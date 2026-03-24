# @formae/extension

Extensao MV3 para sincronizacao local com o SIGAA. O foco continua sendo manter a captura autenticada no dispositivo do usuario, sem backend guardando credenciais ou dados academicos privados.

## O que existe agora

- `manifest.json` com permissões reduzidas para `storage` e `tabs`
- `browser_specific_settings.gecko` para carga em Firefox compatível com MV3
- `src/background.js` como service worker de coordenacao
- `src/content-script.js` como relay `window.postMessage -> runtime message`
- `src/bridge.js` com os kinds de mensagens do protocolo
- `src/login-session.js` com sessao efemera em memoria
- `src/dom-contract.js` com contrato de seletores e classificacao de pagina
- `src/page-bridge.js` com helpers para a ponte de pagina
- `src/sigaa-sync.js` com o runtime automatico que autentica localmente e captura `Minhas Turmas` e `Minhas Notas`
- `src/runtime.js` com compatibilidade `browser`/`chrome`

## Como a extensao conversa com a web app

1. A PWA envia `ProvideEphemeralCredentials` via `window.postMessage`.
2. O content script recebe o envelope e repassa a mensagem para o service worker.
3. O background guarda a sessao apenas em memoria e executa `RequestSync`.
4. O runtime abre abas locais do SIGAA, autentica, captura as views esperadas e devolve um `RawSigaaPayload`.
5. A PWA reaproveita o pipeline local de normalizacao e sela o bundle no vault do navegador.

## Firefox e Chrome

- O manifesto inclui `browser_specific_settings` para Firefox.
- O codigo prefere `globalThis.browser ?? globalThis.chrome`, entao funciona nos dois runtimes sem mudar o contrato de mensagens.
- O suporte em Firefox depende da disponibilidade de MV3/service worker na versao instalada. Para distribuicao publica, a assinatura do addon continua sendo requisito.

## Empacotamento e release

O release da extensao pode ser gerado localmente com:

```bash
node scripts/package-extension.mjs
```

O script cria:

- `dist/extension/formae-extension-<versao>/` com o unpacked build
- `dist/releases/formae-extension-<versao>.zip`
- `dist/releases/formae-extension-<versao>.zip.sha256`

Esses artefatos sao os que o workflow de GitHub Releases publica.

## Convenções

- Credenciais do SIGAA nunca sao persistidas em disco.
- `ProvideEphemeralCredentials` existe apenas para sessao em memoria.
- `NormalizedSnapshot` e `StoreEncryptedSnapshot` continuam como contratos da proxima etapa da integracao.
- `SIGAA_SELECTOR_VERSION` em `src/constants.js` marca o conjunto de seletores testado nesta fase.

## Desenvolvimento

```bash
cd apps/extension
node --test src/*.test.js
```

O diretório ainda não depende de bundler. A intenção é manter o runtime legível e fácil de portar, sem mudar os contratos centrais.
