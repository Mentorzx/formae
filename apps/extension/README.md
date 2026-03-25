# @formae/extension

Extensao MV3 para sincronizacao local com o SIGAA. O foco continua sendo manter a captura autenticada no dispositivo do usuario, sem backend guardando credenciais ou dados academicos privados.

## O que existe agora

- `manifest.json` com permissões reduzidas para `scripting` e `tabs`
- `browser_specific_settings.gecko` para carga em Firefox compatível com MV3
- `src/popup.html` como UI de credenciais efêmeras controlada pela extensão
- `src/background.js` como service worker de coordenacao
- `src/content-script.js` como ponte direta com a extensão e relay legado apenas para depuração local
- `src/bridge.js` com os kinds de mensagens do protocolo
- `src/credential-store.js` e `src/login-session.js` com sessao efemera em memoria
- `src/dom-contract.js` com contrato de seletores e classificacao de pagina
- `src/page-bridge.js` com helpers para a ponte de pagina
- `src/sigaa-sync.js` com o runtime automatico que autentica localmente e captura `Minhas Turmas`, `Minhas Notas` e `Consultar Histórico`, mesmo quando o SIGAA cola varios registros em uma unica linha ou entrega o histórico como PDF/anexo
- `src/runtime.js` com compatibilidade `browser`/`chrome`

## Como a extensao conversa com a web app

1. A pessoa abre a popup da extensão e salva CPF/usuário e senha.
2. O background guarda a sessão apenas em memória e expõe um estado resumido sem senha.
3. Em produção, a PWA tenta falar direto com a extensão via `runtime.sendMessage` externo.
4. O relay legado por `window.postMessage` fica restrito a localhost para depuração, não para GitHub Pages.
5. O runtime abre abas locais do SIGAA, autentica, captura as views esperadas, incluindo o relatório de histórico quando disponível, segmenta capturas com varios registros em uma unica linha, preserva metadados quando o histórico vem como PDF/anexo e devolve um `RawSigaaPayload`.
6. Depois do sync a sessão efêmera é consumida e removida da memória.

## Firefox e Chrome

- O manifesto inclui `browser_specific_settings` para Firefox.
- O codigo prefere `globalThis.browser ?? globalThis.chrome`, entao funciona nos dois runtimes sem mudar o contrato de mensagens.
- O suporte em Firefox depende da disponibilidade de MV3/service worker na versao instalada. Para distribuicao publica, a assinatura do addon continua sendo requisito.
- A UI da popup não depende de APIs específicas de Chrome para a camada de credenciais.

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
- `SetEphemeralCredentials`, `GetCredentialState` e `ClearEphemeralCredentials` existem apenas para a sessão em memória da extensão.
- `ProvideEphemeralCredentials` fica como compatibilidade interna, mas nao é aceito pela ponte da pagina.
- `NormalizedSnapshot` e `StoreEncryptedSnapshot` continuam como contratos da proxima etapa da integracao.
- `SIGAA_SELECTOR_VERSION` em `src/constants.js` marca o conjunto de seletores testado nesta fase.

## Desenvolvimento

```bash
cd apps/extension
node --test src/*.test.js
```

O diretório ainda não depende de bundler. A intenção é manter o runtime legível e fácil de portar, sem mudar os contratos centrais.
