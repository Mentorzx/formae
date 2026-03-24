# @formae/extension

Extensao MV3 para sincronizacao local com o SIGAA. O objetivo aqui e manter o processamento autenticado no navegador do usuario e expor contratos claros para a web app conversar com a extensao sem backend com PII.

## O que existe agora

- `manifest.json` com permissões mínimas e content script local
- `src/background.js` como service worker de coordenacao
- `src/content-script.js` como relay `window.postMessage -> chrome.runtime` para a PWA
- `src/bridge.js` com os kinds de mensagens do protocolo
- `src/login-session.js` com sessão efêmera e sanitização
- `src/dom-contract.js` com contrato de seletores e classificação de página
- `src/page-bridge.js` com helpers para a ponte de página
- `src/sigaa-sync.js` com o runtime automatico que autentica localmente e captura `Minhas Turmas` e `Minhas Notas`
- `RawSigaaPayload` agora carrega `htmlOrText` e um bloco `structuredCapture` opcional com perfil do portal e registros extraidos

## Fluxo esperado

1. A PWA envia `ProvideEphemeralCredentials` via `window.postMessage`.
2. O content script recebe esse envelope e o repassa ao service worker.
3. O background guarda a sessao apenas em memoria e executa `RequestSync`.
4. O runtime abre abas locais do SIGAA, autentica, captura `Minhas Turmas` e `Minhas Notas` e devolve um `RawSigaaPayload`.
5. A PWA reaproveita o pipeline de importacao local, normaliza horarios via Rust/WASM e sela o bundle no vault do navegador.

## Convenções

- Credenciais do SIGAA nunca sao persistidas em disco.
- `ProvideEphemeralCredentials` existe para uso de sessão em memória.
- `NormalizedSnapshot` e `StoreEncryptedSnapshot` continuam como contratos para a proxima etapa da integracao.
- `SIGAA_SELECTOR_VERSION` em `src/dom-contract.js` marca o conjunto de seletores testado nesta fase.

## Desenvolvimento

```bash
cd apps/extension
node --test src/*.test.js
```

Para validar a extensao com a PWA e credenciais locais, use o harness em `infra/private-sync-e2e` com `pnpm sync:web`.

O diretorio ainda nao depende de um bundler. A intencao e manter o runtime legivel e pronto para virar WXT ou outro empacotador depois, sem mudar os contratos centrais.
