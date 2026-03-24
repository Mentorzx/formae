# @formae/extension

Scaffold da extensao MV3 para sincronizacao local com o SIGAA. O objetivo aqui e manter o processamento autenticado no navegador do usuario e expor contratos claros para a web app conversar com a extensao sem backend com PII.

## O que existe agora

- `manifest.json` com permissões mínimas e content script local
- `src/background.js` como service worker de coordenacao
- `src/content-script.js` para detectar páginas do SIGAA e relatar payload bruto
- `src/bridge.js` com os kinds de mensagens do protocolo
- `src/login-session.js` com sessão efêmera e sanitização
- `src/dom-contract.js` com contrato de seletores e classificação de página
- `src/page-bridge.js` para ponte `window.postMessage` futura com a web app

## Fluxo esperado

1. O usuário abre uma página autenticada do SIGAA.
2. O content script identifica a página, normaliza o texto visível e envia um `RawSigaaPayload` ao background.
3. Quando a web app for integrada depois, ela poderá publicar mensagens via ponte de página e receber o mesmo envelope de bridge.
4. O background mantém apenas estado em memória para a sessão atual.

## Convenções

- Credenciais do SIGAA nunca são persistidas em disco por este scaffold.
- `ProvideEphemeralCredentials` existe para uso de sessão em memória.
- `NormalizedSnapshot` e `StoreEncryptedSnapshot` ficam como contratos para a próxima etapa da integração.
- `SIGAA_SELECTOR_VERSION` em `src/dom-contract.js` marca o conjunto de seletores testado nesta fase.

## Desenvolvimento

```bash
cd apps/extension
node --test src/*.test.js
```

O diretório ainda não depende de um bundler. A intenção é manter o scaffold legível e pronto para virar WXT, Vite ou outro empacotador depois, sem mudar os contratos centrais.
