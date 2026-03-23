# ADR 0007: Passkey apenas para unlock local

- Status: Accepted
- Date: 2026-03-23

## Context

WebAuthn e bom para autenticacao na origem do proprio app, mas nao substitui login do SIGAA.

## Decision

Passkeys futuras serao usadas apenas para destravar a experiencia local do Formae, nao para simular SSO com o SIGAA.

## Consequences

- Limite tecnico fica explicito para o usuario.
- O login do SIGAA continua separado e efemero.
- Evita desenho enganoso de autenticacao.

