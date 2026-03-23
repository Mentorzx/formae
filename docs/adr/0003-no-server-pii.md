# ADR 0003: Sem PII no servidor

- Status: Accepted
- Date: 2026-03-23

## Context

Credenciais do SIGAA e snapshots privados aumentam muito o risco tecnico e juridico.

## Decision

Nenhuma credencial do SIGAA ou snapshot academico privado sera persistido em servidor na v0.

## Consequences

- O produto reduz superficie de risco.
- Sincronizacao e armazenamento precisam ser locais.
- Revisao juridica continua obrigatoria antes de releases com dados reais.

